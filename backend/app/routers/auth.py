"""auth: Corporate SSO (OIDC) -- Microsoft Entra ID.

Implements the authorization-code flow against the configured IdP:
`GET /auth/login` redirects to the IdP's authorize endpoint with a
server-generated state and nonce (signed into a short-lived cookie so no
server-side session store is needed before a session exists);
`GET /auth/callback` exchanges the code, verifies the ID token's signature,
issuer, audience and nonce, upserts the local User row on the verified
`sub`, and mints the signed session cookie via `app.auth.create_session_cookie`.
"""

import secrets
from typing import Annotated
from urllib.parse import urlencode

import httpx
from authlib.jose import JsonWebKey, jwt as jose_jwt
from authlib.jose.errors import JoseError
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy.orm import Session

from app.auth import SESSION_COOKIE_NAME, SessionUser, create_session_cookie, get_current_user
from app.config import (
    APP_BASE_URL,
    OIDC_CLIENT_ID,
    OIDC_CLIENT_SECRET,
    OIDC_ISSUER,
    OIDC_REDIRECT_URI,
    SESSION_SECRET,
)
from app.database import get_db
from app.models import User

router = APIRouter(tags=["auth"])

_STATE_COOKIE_NAME = "oidc_state"
_STATE_MAX_AGE_SECONDS = 10 * 60
_SIGNIN_FAILED_DETAIL = "sign-in failed, contact IT"

_state_serializer = URLSafeTimedSerializer(SESSION_SECRET, salt="oidc-state")


def _oidc_configured() -> bool:
    return bool(OIDC_ISSUER and OIDC_CLIENT_ID and OIDC_REDIRECT_URI)


def _discover(issuer: str) -> dict:
    url = issuer.rstrip("/") + "/.well-known/openid-configuration"
    with httpx.Client(timeout=5.0) as client:
        resp = client.get(url)
        resp.raise_for_status()
        return resp.json()


def _sign_in_failed() -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=_SIGNIN_FAILED_DETAIL)


@router.get("/auth/login")
async def login() -> Response:
    """Begin OIDC login: 302 to the configured IdP authorize URL.

    `state` and `nonce` are generated here and stored in a short-lived
    signed cookie so the callback can verify them without a server-side
    session store.
    """
    if not _oidc_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OIDC is not configured; set OIDC_ISSUER, OIDC_CLIENT_ID and OIDC_REDIRECT_URI",
        )

    try:
        discovery = _discover(OIDC_ISSUER)
        authorize_endpoint = discovery["authorization_endpoint"]
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to reach the configured identity provider",
        ) from exc

    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)

    query = urlencode(
        {
            "response_type": "code",
            "client_id": OIDC_CLIENT_ID,
            "redirect_uri": OIDC_REDIRECT_URI,
            "scope": "openid profile email",
            "state": state,
            "nonce": nonce,
        }
    )
    response = RedirectResponse(url=f"{authorize_endpoint}?{query}", status_code=302)
    signed = _state_serializer.dumps({"state": state, "nonce": nonce})
    response.set_cookie(
        _STATE_COOKIE_NAME,
        signed,
        httponly=True,
        samesite="lax",
        max_age=_STATE_MAX_AGE_SECONDS,
    )
    return response


@router.get("/auth/callback")
async def callback(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    code: str | None = None,
    state: str | None = None,
) -> Response:
    """Exchange code+state, verify the ID token, and create the session.

    Failure at any step -- missing/mismatched state, a bad code exchange, or
    an ID token that fails signature/issuer/audience/nonce verification --
    sets no session cookie and returns a plain 401.
    """
    if not _oidc_configured():
        raise _sign_in_failed()

    raw_state_cookie = request.cookies.get(_STATE_COOKIE_NAME)
    if not code or not state or not raw_state_cookie:
        raise _sign_in_failed()

    try:
        stored = _state_serializer.loads(raw_state_cookie, max_age=_STATE_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired) as exc:
        raise _sign_in_failed() from exc

    if not secrets.compare_digest(stored.get("state", ""), state):
        raise _sign_in_failed()
    nonce = stored.get("nonce", "")

    try:
        discovery = _discover(OIDC_ISSUER)
        token_endpoint = discovery["token_endpoint"]
        jwks_uri = discovery["jwks_uri"]

        with httpx.Client(timeout=5.0) as client:
            token_resp = client.post(
                token_endpoint,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": OIDC_REDIRECT_URI,
                    "client_id": OIDC_CLIENT_ID,
                    "client_secret": OIDC_CLIENT_SECRET,
                },
                headers={"Accept": "application/json"},
            )
            token_resp.raise_for_status()
            id_token = token_resp.json()["id_token"]

            jwks_resp = client.get(jwks_uri)
            jwks_resp.raise_for_status()
            key_set = JsonWebKey.import_key_set(jwks_resp.json())

        claims = jose_jwt.decode(
            id_token,
            key_set,
            claims_options={
                "iss": {"essential": True, "values": [OIDC_ISSUER, OIDC_ISSUER.rstrip("/")]},
                "aud": {"essential": True, "value": OIDC_CLIENT_ID},
                "nonce": {"essential": True, "value": nonce},
            },
        )
        claims.validate()
    except (httpx.HTTPError, KeyError, ValueError, JoseError) as exc:
        raise _sign_in_failed() from exc

    subject = claims.get("sub")
    if not subject:
        raise _sign_in_failed()

    display_name = claims.get("name") or claims.get("preferred_username") or subject
    group_claims = list(claims.get("groups") or [])

    user_row = db.query(User).filter(User.idp_subject == subject).one_or_none()
    if user_row is None:
        user_row = User(idp_subject=subject, display_name=display_name, group_claims=group_claims)
        db.add(user_row)
    else:
        user_row.display_name = display_name
        user_row.group_claims = group_claims
    db.commit()
    db.refresh(user_row)

    session_user = SessionUser(
        id=str(user_row.id), display_name=display_name, group_claims=group_claims
    )
    cookie_value = create_session_cookie(session_user)

    response = RedirectResponse(url=APP_BASE_URL, status_code=302)
    response.delete_cookie(_STATE_COOKIE_NAME)
    response.set_cookie(
        SESSION_COOKIE_NAME,
        cookie_value,
        httponly=True,
        samesite="lax",
        max_age=8 * 60 * 60,
    )
    return response


@router.post("/auth/logout", status_code=204)
async def logout(user: Annotated[SessionUser, Depends(get_current_user)]) -> Response:
    """Terminate the session so prior conversation content is not shown.

    204 with no body, per spec -- a real body on a 204 response is a
    protocol violation, so this does not return the typed placeholder the
    other stubs do.
    """
    response = Response(status_code=204)
    response.delete_cookie(SESSION_COOKIE_NAME)
    return response
