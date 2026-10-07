"""backend_api: feedback on a single answer."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.auth import SessionUser, get_current_user
from app.database import get_db
from app.models import Conversation, Feedback, Message
from app.schemas import FeedbackRequest

router = APIRouter(tags=["messages"])

_VALID_RATINGS = (1, -1)


@router.post("/messages/{message_id}/feedback", status_code=204)
async def submit_feedback(
    message_id: str,
    body: FeedbackRequest,
    user: Annotated[SessionUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    """Record thumbs up/down on an answer.

    `rating` is 1 (thumbs up) or -1 (thumbs down); anything else is a 400.
    Scoped to the caller's own conversation the same way app.routers.
    conversations is: a message that exists but belongs to someone else's
    conversation comes back 404, identical to one that does not exist at
    all, never a 403 that would confirm the id is real. A second call for
    the same (message, user) replaces the previous rating rather than
    accumulating duplicate rows.
    """
    if body.rating not in _VALID_RATINGS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="rating must be 1 (up) or -1 (down)"
        )

    try:
        msg_uuid = uuid.UUID(message_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Message not found"
        ) from exc

    message = db.get(Message, msg_uuid)
    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    user_id = uuid.UUID(user.id)
    conversation = db.get(Conversation, message.conversation_id)
    if conversation is None or conversation.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    existing = (
        db.query(Feedback)
        .filter(Feedback.message_id == msg_uuid, Feedback.user_id == user_id)
        .one_or_none()
    )
    if existing is not None:
        existing.rating = body.rating
    else:
        db.add(Feedback(message_id=msg_uuid, user_id=user_id, rating=body.rating))
    db.commit()

    return Response(status_code=204)
