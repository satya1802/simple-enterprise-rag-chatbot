"""auth: Corporate SSO (OIDC) -- the three routes the API spec names.

Stub only. The authorization-code exchange with Microsoft Entra ID, ID-token
verification and group-claim mapping are the development sprint's work; what
is here is the shape of the contract, wired to the shared session dependency
in `app.auth` so every other router can depend on `get_current_user` without
caring how the session got created.
"""

from fastapi import APIRouter, Depends, Response

from app.auth import SessionUser, get_current_user
from app.schemas import StubResponse

router = APIRouter(tags=["auth"])


@router.get("/auth/login", response_model=StubResponse)
async def login() -> StubResponse:
    """Begin OIDC login, redirect to corporate IdP.

    Spec: 302 redirect to the IdP. Returning that redirect for real needs the
    IdP's authorize URL, built from OIDC_ISSUER/OIDC_CLIENT_ID in
    app.config via the Authlib round trip -- the sprint's work.
    """
    return StubResponse(endpoint="GET /auth/login")


@router.get("/auth/callback", response_model=StubResponse)
async def callback(code: str | None = None, state: str | None = None) -> StubResponse:
    """Handle the IdP redirect and create a session.

    Spec: 302 to the app with a session cookie, or 401 sign-in failed.
    Minting the cookie for real calls `app.auth.create_session_cookie` with a
    verified SessionUser once the code/state exchange is implemented.
    """
    return StubResponse(endpoint="GET /auth/callback")


@router.post("/auth/logout", status_code=204)
async def logout(user: SessionUser = Depends(get_current_user)) -> Response:
    """Terminate the session so prior conversation content is not shown.

    204 with no body, per spec -- a real body on a 204 response is a
    protocol violation, so this does not return the typed placeholder the
    other stubs do.
    """
    return Response(status_code=204)
