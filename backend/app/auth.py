"""Shared session dependency.

Every content endpoint in the API spec depends on `get_current_user`, which
is what makes "every content endpoint requires an authenticated session" a
fact about the code rather than a sentence in the architecture doc. How the
cookie gets set -- the OIDC authorization-code exchange and the group-claim
mapping on `GET /auth/callback` -- is the development sprint's work; this
module only owns the one shared contract the rest of the routers import:
no valid signed session, no corpus content, a 401 challenge.
"""

from dataclasses import dataclass, field

from fastapi import Cookie, HTTPException, status
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.config import SESSION_LIFETIME_SECONDS, SESSION_SECRET

SESSION_COOKIE_NAME = "session"

_serializer = URLSafeTimedSerializer(SESSION_SECRET)


@dataclass
class SessionUser:
    """The subject id and group claims OIDC put on the session.

    `is_admin` is derived from group_claims rather than stored, per `GET
    /me`'s contract: role is a read of the claims, not a separate field.
    """

    id: str
    display_name: str
    group_claims: list[str] = field(default_factory=list)

    @property
    def is_admin(self) -> bool:
        return "KB-Knowledge-Admins" in self.group_claims


def create_session_cookie(user: SessionUser) -> str:
    """Sign a session payload for the given user.

    Called by the real `POST /auth/callback` handler once the IdP code/state
    exchange has produced a verified subject id and group claims.
    """
    return _serializer.dumps(
        {"id": user.id, "display_name": user.display_name, "group_claims": user.group_claims}
    )


def read_session_cookie(token: str) -> SessionUser | None:
    """Verify and unsign a session cookie, or `None` if it is missing/bad."""
    try:
        data = _serializer.loads(token, max_age=SESSION_LIFETIME_SECONDS)
    except (BadSignature, SignatureExpired):
        return None
    return SessionUser(**data)


async def get_current_user(
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> SessionUser:
    """FastAPI dependency every session-protected route declares.

    No cookie, a bad signature, or an expired one are all the same failure:
    a 401 challenge and no corpus content, exactly as the architecture notes
    require.
    """
    user = read_session_cookie(session) if session else None
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": 'Bearer realm="auth"'},
        )
    return user
