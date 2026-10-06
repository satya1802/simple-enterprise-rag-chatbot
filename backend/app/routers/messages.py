"""backend_api: feedback on a single answer."""

from typing import Annotated

from fastapi import APIRouter, Depends, Response

from app.auth import SessionUser, get_current_user
from app.schemas import FeedbackRequest

router = APIRouter(tags=["messages"])


@router.post("/messages/{message_id}/feedback", status_code=204)
async def submit_feedback(
    message_id: str,
    body: FeedbackRequest,
    user: Annotated[SessionUser, Depends(get_current_user)],
) -> Response:
    """Record thumbs up/down on an answer."""
    return Response(status_code=204)
