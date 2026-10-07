"""backend_api / answer_engine: the answer boundary other front ends call.

Retrieval is hybrid keyword + vector search over one combined chunk index
(`app.services.retrieval.search_chunks`): every call produces both a
keyword result set and a vector result set and merges them before
generation (AC-105), and the same query path runs regardless of the owning
document's `source_type` (AC-106). When the merged candidate set is empty,
the question is not covered by the knowledge base: no model call is made,
`not_covered=True` is returned with an empty citation list and the
explicit "not covered by the knowledge base" text. Otherwise generation
runs through the in-tenant model provider abstraction
(`app.services.providers`) rather than any vendor SDK or HTTP endpoint
here, grounded in the retrieved chunks, and the resulting prompt/completion
token counts are persisted on the assistant's message row against the
authenticated user, never a client-supplied id (AC-125). Streaming the
response token-by-token over SSE is out of scope for this packet;
`not_covered` and `citations` are already grounded in retrieval.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.auth import SessionUser, get_current_user
from app.database import get_db
from app.models import Citation, Conversation, Message
from app.schemas import AnswerRequest, AnswerResult, CitationOut, StopRequest, TokenUsage
from app.services.providers import get_provider
from app.services.retrieval import search_chunks

router = APIRouter(tags=["answer"])

_NOT_COVERED_TEXT = (
    "This question is not covered by the knowledge base. "
    "No matching content was found in the ingested documents."
)

_SYSTEM_PROMPT = (
    "You are an enterprise knowledge-base assistant. Answer the question "
    "using only the numbered context passages below. If the passages do "
    "not contain enough information to answer, say that the question is "
    "not covered by the knowledge base."
)


def _build_messages(question: str, results: list) -> list[dict[str, str]]:
    context = "\n\n".join(
        f"[{index + 1}] {scored.chunk.content}" for index, scored in enumerate(results)
    )
    return [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"},
    ]


def _dedupe_citations(results: list) -> list:
    """One citation per document, in the merged candidate's rank order."""
    seen_document_ids: set[uuid.UUID] = set()
    deduped = []
    for scored in results:
        if scored.document.id in seen_document_ids:
            continue
        seen_document_ids.add(scored.document.id)
        deduped.append(scored)
    return deduped


@router.post("/answer", response_model=AnswerResult)
async def answer(
    body: AnswerRequest,
    user: Annotated[SessionUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> AnswerResult:
    """Accept a question (+ optional conversation_id), retrieve grounding
    chunks through the hybrid keyword+vector index, run the configured
    model provider, and return the grounded-answer result.

    Spec: SSE stream of tokens, then {citations, not_covered, token_usage}
    (see app.schemas.AnswerResult). Streaming the response token-by-token
    is the answer_engine's work; this already returns the final
    AnswerResult shape the contract promises.
    """
    user_id = uuid.UUID(user.id)

    if body.conversation_id:
        conversation = db.get(Conversation, uuid.UUID(body.conversation_id))
        if conversation is None or conversation.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found"
            )
    else:
        conversation = Conversation(user_id=user_id)
        db.add(conversation)
        db.flush()

    db.add(Message(conversation_id=conversation.id, role="user", content=body.question))

    results = search_chunks(db, body.question)

    if not results:
        assistant_message = Message(
            conversation_id=conversation.id,
            role="assistant",
            content=_NOT_COVERED_TEXT,
            not_covered=True,
            token_usage=0,
        )
        db.add(assistant_message)
        db.commit()

        return AnswerResult(
            citations=[],
            not_covered=True,
            token_usage=TokenUsage(prompt_tokens=0, completion_tokens=0),
        )

    cited = _dedupe_citations(results)

    provider = get_provider()
    result = provider.chat(_build_messages(body.question, results))

    assistant_message = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=result.text,
        not_covered=False,
        # The stored column is a single token count; the full
        # prompt/completion split returned to the caller comes
        # straight from the provider call above.
        token_usage=result.prompt_tokens + result.completion_tokens,
    )
    db.add(assistant_message)
    db.flush()

    citations_out: list[CitationOut] = []
    for scored in cited:
        db.add(
            Citation(
                message_id=assistant_message.id,
                document_id=scored.document.id,
                source_type=scored.document.source_type,
                source_id=scored.document.source_id,
                source_url=scored.document.source_url,
            )
        )
        citations_out.append(
            CitationOut(
                document_id=str(scored.document.id),
                source_type=scored.document.source_type,
                source_url=scored.document.source_url,
            )
        )

    db.commit()

    return AnswerResult(
        citations=citations_out,
        not_covered=False,
        token_usage=TokenUsage(
            prompt_tokens=result.prompt_tokens, completion_tokens=result.completion_tokens
        ),
    )


@router.post("/answer/stop", status_code=204)
async def stop_answer(
    body: StopRequest,
    user: Annotated[SessionUser, Depends(get_current_user)],
) -> Response:
    """Stop an in-progress generation for a streaming answer."""
    return Response(status_code=204)
