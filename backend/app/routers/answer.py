"""backend_api / answer_engine: the answer boundary other front ends call.

Retrieval is hybrid keyword + vector search over one combined chunk index
(`app.services.retrieval.search_chunks`): every call produces both a
keyword result set and a vector result set and merges them before
generation (AC-105), and the same query path runs regardless of the owning
document's `source_type` (AC-106). Candidates below the configured
relevance threshold are discarded by `search_chunks` itself (AC-100); when
the merged, threshold-passing candidate set is empty, the question is not
covered by the knowledge base: no model call is made, `not_covered=True`
is streamed with an empty citation list and the explicit "not covered by
the knowledge base" text (AC-013/AC-099).

Generation runs through the in-tenant model provider abstraction
(`app.services.providers`) rather than any vendor SDK or HTTP endpoint
here, grounded only in the retrieved chunks, and streamed token-by-token
over SSE as the provider's `stream_chat` yields deltas -- this module never
buffers a full completion before sending the first token (AC-011). The
first SSE event carries a `stream_id`; `POST /answer/stop` with that id
halts generation server-side via an in-process stop flag, persists the
partial assistant message marked `stopped`, and lets the generator close
the stream cleanly (AC-092). A provider or retrieval failure emits a
terminal `error` event and rolls back any uncommitted partial message, so
no partial text is ever persisted or returned as a complete answer
(AC-093).
"""

import json
import logging
import threading
import time
import uuid
from collections.abc import Iterator
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.auth import SessionUser, get_current_user
from app.config import RETRIEVAL_PARTIAL_CONFIDENCE_THRESHOLD
from app.database import get_db
from app.models import Citation, Conversation, Document, Message
from app.schemas import (
    AnswerRequest,
    AnswerResult,
    ErrorEvent,
    StoppedEvent,
    StopRequest,
    TokenEvent,
)
from app.services.providers import get_provider
from app.services.resolution import resolve_question
from app.services.retrieval import ScoredChunk, search_chunks

router = APIRouter(tags=["answer"])

logger = logging.getLogger(__name__)

_NOT_COVERED_TEXT = (
    "This question is not covered by the knowledge base. "
    "No matching content was found in the ingested documents."
)

_EMPTY_KNOWLEDGE_BASE_TEXT = (
    "This question is not covered by the knowledge base: no documents have "
    "been uploaded yet. Upload one or more documents to the knowledge base "
    "before asking questions."
)

_SYSTEM_PROMPT = (
    "You are an enterprise knowledge-base assistant. Answer the question "
    "using only the numbered context passages below; never use outside or "
    "general knowledge, even if you know the answer from training data. If "
    "the passages do not contain enough information to answer, say "
    "explicitly that the question is not covered by the knowledge base."
)

_PARTIAL_COVERAGE_ADDENDUM = (
    " The retrieved context only partially addresses this question: answer "
    "the part that is supported by the context, and explicitly state which "
    "part of the question the context does not address."
)

# stream_id -> {"stop": threading.Event, "message_id": uuid.UUID | None}.
# In-process registry so POST /answer/stop can signal the generator thread
# streaming a given stream_id to halt (AC-092). Entries are removed by the
# generator itself once the stream ends, however it ends.
_stream_registry_lock = threading.Lock()
_stream_registry: dict[str, dict] = {}


def _build_messages(
    question: str, results: list[ScoredChunk], partial: bool
) -> list[dict[str, str]]:
    context = "\n\n".join(
        f"[{index + 1}] {scored.chunk.content}" for index, scored in enumerate(results)
    )
    system = _SYSTEM_PROMPT + (_PARTIAL_COVERAGE_ADDENDUM if partial else "")
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"},
    ]


def _dedupe_citations(results: list[ScoredChunk]) -> list[ScoredChunk]:
    """One citation per document, in the merged candidate's rank order (AC-096)."""
    seen_document_ids: set[uuid.UUID] = set()
    deduped = []
    for scored in results:
        if scored.document.id in seen_document_ids:
            continue
        seen_document_ids.add(scored.document.id)
        deduped.append(scored)
    return deduped


def _derive_title(question: str) -> str:
    """The auto-generated title for a brand-new conversation (AC: US-016-1).

    Trimmed of surrounding whitespace and capped at 60 characters, derived
    only from the first user question -- never touched again after a
    conversation already has one.
    """
    title = question.strip()
    if len(title) > 60:
        title = title[:60].rstrip()
    return title or "New conversation"


def _citation_source_url(document: Document) -> str | None:
    """Every citation's clickable URL (AC-097).

    Uploaded files have no independent source URL of their own -- the
    canonical way to open or download one is the document API itself
    (AC-095); Confluence/Jira-sourced documents carry their own
    `source_url`, populated by the ingest worker.
    """
    if document.source_type == "upload":
        return f"/documents/{document.id}/file"
    return document.source_url


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _citation_payload(scored: ScoredChunk) -> dict:
    return {
        "document_id": str(scored.document.id),
        "source_type": scored.document.source_type,
        "source_id": scored.document.source_id,
        "source_url": _citation_source_url(scored.document),
    }


def _generate_answer_stream(
    db: Session,
    conversation_id: uuid.UUID,
    question: str,
) -> Iterator[str]:
    stream_id = uuid.uuid4().hex
    stop_event = threading.Event()
    with _stream_registry_lock:
        _stream_registry[stream_id] = {"stop": stop_event, "message_id": None}

    start_time = time.monotonic()
    ttft_ms: float | None = None
    first_token_sent = False

    def _note_first_token() -> None:
        nonlocal ttft_ms, first_token_sent
        if first_token_sent:
            return
        first_token_sent = True
        ttft_ms = (time.monotonic() - start_time) * 1000
        logger.info("answer stream %s time_to_first_token_ms=%.1f", stream_id, ttft_ms)

    try:
        try:
            results = search_chunks(db, question)
        except Exception:  # noqa: BLE001 -- surfaced as a retry-able SSE error
            logger.exception("retrieval failed for stream %s", stream_id)
            yield _sse(
                "error",
                {
                    "stream_id": stream_id,
                    "message": "Retrieval failed; please try again.",
                },
            )
            return

        if not results:
            is_empty_corpus = db.query(Document).count() == 0
            text = _EMPTY_KNOWLEDGE_BASE_TEXT if is_empty_corpus else _NOT_COVERED_TEXT

            not_covered_message = Message(
                conversation_id=conversation_id,
                role="assistant",
                content=text,
                not_covered=True,
                token_usage=0,
            )
            db.add(not_covered_message)
            db.commit()

            _note_first_token()
            yield _sse("token", {"stream_id": stream_id, "delta": text})
            yield _sse(
                "done",
                AnswerResult(
                    stream_id=stream_id,
                    message_id=str(not_covered_message.id),
                    citations=[],
                    not_covered=True,
                    partial=False,
                    token_usage={"prompt_tokens": 0, "completion_tokens": 0},
                    time_to_first_token_ms=ttft_ms,
                ).model_dump(),
            )
            return

        cited = _dedupe_citations(results)
        max_relevance = max(scored.relevance for scored in results)
        partial = max_relevance < RETRIEVAL_PARTIAL_CONFIDENCE_THRESHOLD

        provider = get_provider()
        messages = _build_messages(question, results, partial)

        assistant_message = Message(
            conversation_id=conversation_id,
            role="assistant",
            content="",
            not_covered=False,
            token_usage=0,
        )
        db.add(assistant_message)
        db.flush()
        with _stream_registry_lock:
            _stream_registry[stream_id]["message_id"] = assistant_message.id

        text_parts: list[str] = []
        prompt_tokens = 0
        completion_tokens = 0
        stopped = False

        try:
            for chunk in provider.stream_chat(messages):
                if stop_event.is_set():
                    stopped = True
                    break
                if chunk.done:
                    prompt_tokens = chunk.prompt_tokens
                    completion_tokens = chunk.completion_tokens
                    continue
                if not chunk.delta:
                    continue
                text_parts.append(chunk.delta)
                _note_first_token()
                yield _sse("token", {"stream_id": stream_id, "delta": chunk.delta})
        except Exception:  # noqa: BLE001 -- surfaced as a retry-able SSE error
            logger.exception("generation failed for stream %s", stream_id)
            db.rollback()
            yield _sse(
                "error",
                {
                    "stream_id": stream_id,
                    "message": "Answer generation failed; please try again.",
                },
            )
            return

        if stopped:
            assistant_message.content = "".join(text_parts)
            assistant_message.stopped = True
            db.commit()
            yield _sse("stopped", {"stream_id": stream_id})
            return

        for scored in cited:
            db.add(
                Citation(
                    message_id=assistant_message.id,
                    document_id=scored.document.id,
                    source_type=scored.document.source_type,
                    source_id=scored.document.source_id,
                    source_url=_citation_source_url(scored.document),
                )
            )

        assistant_message.content = "".join(text_parts)
        assistant_message.token_usage = prompt_tokens + completion_tokens
        db.commit()

        yield _sse(
            "done",
            AnswerResult(
                stream_id=stream_id,
                message_id=str(assistant_message.id),
                citations=[_citation_payload(scored) for scored in cited],
                not_covered=False,
                partial=partial,
                token_usage={
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                },
                time_to_first_token_ms=ttft_ms,
            ).model_dump(),
        )
    finally:
        with _stream_registry_lock:
            _stream_registry.pop(stream_id, None)


@router.post(
    "/answer",
    responses={
        200: {
            "description": (
                "Server-Sent Events stream, identical for any authenticated "
                "caller (no React-specific framing): each `event:` line "
                "names one of four event types and `data:` carries that "
                "event's JSON payload. Zero or more `token` events "
                "(TokenEvent: `stream_id`, `delta`) precede exactly one "
                "terminal event -- `done` (AnswerResult: `stream_id`, "
                "`citations[]` of {document_id, source_type, source_id, "
                "source_url}, `not_covered`, `partial`, `token_usage`, "
                "`time_to_first_token_ms`), `stopped` (StoppedEvent: "
                "`stream_id`, after POST /answer/stop takes effect), or "
                "`error` (ErrorEvent: `stream_id`, `message`) on a "
                "retrieval or provider failure. When no retrieved chunk "
                "clears the relevance threshold, the terminal `done` event "
                "has `not_covered=true`, `citations=[]`, and the preceding "
                "`token` text states explicitly that the question is not "
                "covered by the knowledge base -- identical for any caller."
            ),
            "content": {
                "text/event-stream": {
                    "schema": {
                        "oneOf": [
                            TokenEvent.model_json_schema(),
                            AnswerResult.model_json_schema(),
                            StoppedEvent.model_json_schema(),
                            ErrorEvent.model_json_schema(),
                        ]
                    },
                    "examples": {
                        "token": {
                            "summary": "token event",
                            "value": {"stream_id": "a1b2c3", "delta": "The "},
                        },
                        "done": {
                            "summary": "done event (terminal)",
                            "value": {
                                "stream_id": "a1b2c3",
                                "message_id": "7e4411b0-3c92-4a5d-8f31-b0d2e6c7a119",
                                "citations": [
                                    {
                                        "document_id": "3f9c...",
                                        "source_type": "confluence",
                                        "source_id": "123456",
                                        "source_url": "https://example.atlassian.net/wiki/x",
                                    }
                                ],
                                "not_covered": False,
                                "partial": False,
                                "token_usage": {
                                    "prompt_tokens": 512,
                                    "completion_tokens": 128,
                                },
                                "time_to_first_token_ms": 340.5,
                            },
                        },
                        "not_covered": {
                            "summary": "done event, question not covered by the knowledge base",
                            "value": {
                                "stream_id": "a1b2c3",
                                "message_id": "9f1c2d44-7a80-4f61-b0ac-2d5e9a1f33b2",
                                "citations": [],
                                "not_covered": True,
                                "partial": False,
                                "token_usage": {"prompt_tokens": 0, "completion_tokens": 0},
                                "time_to_first_token_ms": None,
                            },
                        },
                        "stopped": {
                            "summary": "stopped event (terminal)",
                            "value": {"stream_id": "a1b2c3"},
                        },
                        "error": {
                            "summary": "error event (terminal)",
                            "value": {
                                "stream_id": "a1b2c3",
                                "message": "Answer generation failed; please try again.",
                            },
                        },
                    },
                }
            },
        },
        401: {
            "description": (
                "No valid session: a 401 challenge with a WWW-Authenticate "
                "header and no corpus content in the body, enforced by the "
                "shared get_current_user dependency regardless of caller."
            ),
        },
    },
)
async def answer(
    body: AnswerRequest,
    user: Annotated[SessionUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> StreamingResponse:
    """Accept a question (+ optional conversation_id) and stream the grounded
    answer back as Server-Sent Events.

    Retrieval runs over the whole corpus with no caller-supplied scope or
    source_type filter (AC-108) -- `AnswerRequest` has no filter field and
    none is read here. Generation, streaming and persistence are all done
    inside `_generate_answer_stream`, which is where the actual SSE body is
    produced; this handler only validates the conversation and persists the
    user's own message before the stream starts.
    """
    user_id = uuid.UUID(user.id)

    if body.conversation_id:
        conversation = db.get(Conversation, uuid.UUID(body.conversation_id))
        if conversation is None or conversation.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found"
            )
        if not conversation.title:
            # An empty conversation opened via POST /conversations has no
            # title yet; its first /answer turn titles it exactly as a
            # brand-new conversation would (AC: US-016-1). A conversation
            # that already has one is never retitled by a later turn.
            conversation.title = _derive_title(body.question)
    else:
        # The first user question of a brand-new conversation is also its
        # title (trimmed, <=60 chars): titled once, here, at creation --
        # subsequent turns on this same conversation_id never touch title.
        conversation = Conversation(user_id=user_id, title=_derive_title(body.question))
        db.add(conversation)
        db.flush()

    # Resolved against whatever prior turns this conversation already has
    # (none, for a brand-new one) *before* the raw question below is
    # persisted, so the history used here never includes the current turn
    # itself (AC-015/AC-111/AC-112). The raw text is what is stored as the
    # user message; only the resolved question is handed to retrieval and
    # generation.
    resolved_question = resolve_question(db, conversation.id, body.question)

    conversation.updated_at = datetime.utcnow()
    db.add(Message(conversation_id=conversation.id, role="user", content=body.question))
    db.commit()

    return StreamingResponse(
        _generate_answer_stream(db, conversation.id, resolved_question),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post(
    "/answer/stop",
    status_code=204,
    responses={
        401: {
            "description": (
                "No valid session: a 401 challenge with a WWW-Authenticate "
                "header and no corpus content in the body."
            ),
        },
    },
)
async def stop_answer(
    body: StopRequest,
    user: Annotated[SessionUser, Depends(get_current_user)],
) -> Response:
    """Stop an in-progress generation for a streaming answer.

    Setting the registered stop flag is all this endpoint does; the
    generator streaming `body.stream_id` is the one that notices it,
    persists the partial assistant message marked `stopped`, and closes the
    stream (AC-092). An unknown or already-finished stream_id is a no-op:
    stopping something that is not running has nothing left to stop.
    """
    with _stream_registry_lock:
        entry = _stream_registry.get(body.stream_id)
        if entry is not None:
            entry["stop"].set()
    return Response(status_code=204)
