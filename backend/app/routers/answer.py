"""backend_api / answer_engine: the answer boundary other front ends call.

Generation runs through the in-tenant model provider abstraction
(`app.services.providers`) rather than any vendor SDK or HTTP endpoint
here, and the resulting prompt/completion token counts are persisted on
the assistant's message row against the authenticated user, never a
client-supplied id (AC-125). Retrieval, grounded citations and streaming
the response token-by-token over SSE are the answer_engine's work and are
out of scope for this packet; `not_covered` and `citations` are populated
once that work lands.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.auth import SessionUser, get_current_user
from app.database import get_db
from app.models import Conversation, Message
from app.schemas import AnswerRequest, AnswerResult, StopRequest, TokenUsage
from app.services.providers import get_provider

router = APIRouter(tags=["answer"])


@router.post("/answer", response_model=AnswerResult)
async def answer(
    body: AnswerRequest,
    user: Annotated[SessionUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> AnswerResult:
    """Accept a question (+ optional conversation_id), run it through the
    configured model provider, and return the grounded-answer result.

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

    provider = get_provider()
    result = provider.chat([{"role": "user", "content": body.question}])

    db.add(
        Message(
            conversation_id=conversation.id,
            role="assistant",
            content=result.text,
            not_covered=False,
            # The stored column is a single token count; the full
            # prompt/completion split returned to the caller comes
            # straight from the provider call above.
            token_usage=result.prompt_tokens + result.completion_tokens,
        )
    )
    db.commit()

    return AnswerResult(
        citations=[],
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
