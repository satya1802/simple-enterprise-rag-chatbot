"""backend_api: the signed-in employee's own conversation history.

Every handler scopes its query to `Conversation.user_id == <caller>` --
another user's conversation_id is indistinguishable from one that does not
exist, so it is a 404, never a 403 (that would confirm the id is real).
"""

import uuid
from collections import defaultdict
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.auth import SessionUser, get_current_user
from app.database import get_db
from app.models import Citation, Conversation, Message
from app.schemas import CitationOut, ConversationDetail, ConversationSummary, MessageOut

router = APIRouter(tags=["conversations"])


def _get_owned_conversation(db: Session, conversation_id: str, user_id: uuid.UUID) -> Conversation:
    try:
        parsed_id = uuid.UUID(conversation_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found"
        ) from exc

    conversation = db.get(Conversation, parsed_id)
    if conversation is None or conversation.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return conversation


@router.get("/conversations", response_model=list[ConversationSummary])
async def list_conversations(
    user: Annotated[SessionUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[ConversationSummary]:
    """List the signed-in employee's own conversations, most recent first."""
    user_id = uuid.UUID(user.id)
    conversations = (
        db.query(Conversation)
        .filter(Conversation.user_id == user_id)
        .order_by(Conversation.updated_at.desc())
        .all()
    )
    if not conversations:
        return []

    count_by_conversation: dict[uuid.UUID, int] = defaultdict(int)
    for (conversation_id,) in (
        db.query(Message.conversation_id)
        .filter(Message.conversation_id.in_([c.id for c in conversations]))
        .all()
    ):
        count_by_conversation[conversation_id] += 1

    return [
        ConversationSummary(
            id=str(conversation.id),
            title=conversation.title,
            created_at=conversation.created_at,
            updated_at=conversation.updated_at,
            message_count=count_by_conversation.get(conversation.id, 0),
        )
        for conversation in conversations
    ]


@router.post("/conversations", response_model=ConversationSummary, status_code=201)
async def create_conversation(
    user: Annotated[SessionUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ConversationSummary:
    """Start a new empty conversation, owned by the caller.

    Untitled: POST /answer gives the first conversation its title once its
    first question is known (see app.routers.answer._derive_title).
    """
    conversation = Conversation(user_id=uuid.UUID(user.id))
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return ConversationSummary(
        id=str(conversation.id),
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        message_count=0,
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: str,
    user: Annotated[SessionUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ConversationDetail:
    """Reopen a saved conversation with its full message sequence and citations."""
    conversation = _get_owned_conversation(db, conversation_id, uuid.UUID(user.id))

    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.asc())
        .all()
    )
    message_ids = [m.id for m in messages]
    citations_by_message: dict[uuid.UUID, list[Citation]] = defaultdict(list)
    if message_ids:
        for citation in db.query(Citation).filter(Citation.message_id.in_(message_ids)).all():
            citations_by_message[citation.message_id].append(citation)

    message_outs = [
        MessageOut(
            role=message.role,
            content=message.content,
            citations=[
                CitationOut(
                    document_id=str(citation.document_id),
                    source_type=citation.source_type,
                    source_id=citation.source_id,
                    source_url=citation.source_url,
                )
                for citation in citations_by_message.get(message.id, [])
            ],
        )
        for message in messages
    ]

    return ConversationDetail(
        id=str(conversation.id),
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        messages=message_outs,
    )


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: str,
    user: Annotated[SessionUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    """Delete one of the employee's own conversations and its messages."""
    conversation = _get_owned_conversation(db, conversation_id, uuid.UUID(user.id))

    message_ids = [
        message_id
        for (message_id,) in db.query(Message.id)
        .filter(Message.conversation_id == conversation.id)
        .all()
    ]
    if message_ids:
        db.query(Citation).filter(Citation.message_id.in_(message_ids)).delete(
            synchronize_session=False
        )
        db.query(Message).filter(Message.conversation_id == conversation.id).delete(
            synchronize_session=False
        )
    db.delete(conversation)
    db.commit()
    return Response(status_code=204)
