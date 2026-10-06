"""backend_api: the one user-facing identity endpoint, GET /me."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth import SessionUser, get_current_user
from app.schemas import StubResponse

router = APIRouter(tags=["users"])


@router.get("/me", response_model=StubResponse)
async def me(user: Annotated[SessionUser, Depends(get_current_user)]) -> StubResponse:
    """Return current user display name and role derived from group claims.

    Shape: `app.schemas.UserOut`. The real handler reads it off
    `user.display_name` / `user.is_admin` once this stops returning the
    placeholder.
    """
    return StubResponse(endpoint="GET /me")
