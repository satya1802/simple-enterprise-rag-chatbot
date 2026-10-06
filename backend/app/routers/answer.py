"""backend_api / answer_engine: the answer boundary other front ends call.

Retrieval, grounding and the SSE token stream are the answer_engine's work.
This stub only holds the route's place in the contract -- same path, same
auth, same request shape -- so the frontend and future Teams/Slack callers
compile against something that already resolves.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Response

from app.auth import SessionUser, get_current_user
from app.schemas import AnswerRequest, StopRequest, StubResponse

router = APIRouter(tags=["answer"])


@router.post("/answer", response_model=StubResponse)
async def answer(
    body: AnswerRequest,
    user: Annotated[SessionUser, Depends(get_current_user)],
) -> StubResponse:
    """Accept a question (+ optional conversation_id), stream a grounded answer.

    Spec: SSE stream of tokens, then {citations, not_covered, token_usage}
    (see app.schemas.AnswerResult). Streaming the response is the
    answer_engine's work.
    """
    return StubResponse(endpoint="POST /answer")


@router.post("/answer/stop", status_code=204)
async def stop_answer(
    body: StopRequest,
    user: Annotated[SessionUser, Depends(get_current_user)],
) -> Response:
    """Stop an in-progress generation for a streaming answer."""
    return Response(status_code=204)
