"""backend_api: the signed-in employee's own conversation history."""

from typing import Annotated

from fastapi import APIRouter, Depends, Response

from app.auth import SessionUser, get_current_user
from app.schemas import StubResponse

router = APIRouter(tags=["conversations"])


@router.get("/conversations", response_model=StubResponse)
async def list_conversations(
    user: Annotated[SessionUser, Depends(get_current_user)],
) -> StubResponse:
    """List the signed-in employee's own conversations, most recent first."""
    return StubResponse(endpoint="GET /conversations")


@router.post("/conversations", response_model=StubResponse)
async def create_conversation(
    user: Annotated[SessionUser, Depends(get_current_user)],
) -> StubResponse:
    """Start a new empty conversation."""
    return StubResponse(endpoint="POST /conversations")


@router.get("/conversations/{conversation_id}", response_model=StubResponse)
async def get_conversation(
    conversation_id: str,
    user: Annotated[SessionUser, Depends(get_current_user)],
) -> StubResponse:
    """Reopen a saved conversation with its full message sequence and citations."""
    return StubResponse(endpoint="GET /conversations/{id}")


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: str,
    user: Annotated[SessionUser, Depends(get_current_user)],
) -> Response:
    """Delete one of the employee's own conversations."""
    return Response(status_code=204)
