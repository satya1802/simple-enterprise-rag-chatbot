"""backend_api: the one user-facing identity endpoint, GET /me."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth import SessionUser, get_current_user
from app.schemas import UserOut

router = APIRouter(tags=["users"])


@router.get("/me", response_model=UserOut)
async def me(user: Annotated[SessionUser, Depends(get_current_user)]) -> UserOut:
    """Return current user display name and role derived from group claims."""
    return UserOut(id=user.id, display_name=user.display_name, is_admin=user.is_admin)
