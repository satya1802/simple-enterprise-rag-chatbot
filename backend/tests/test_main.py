"""Baseline tests for the scaffolded service.

These exist to prove the toolchain works, not to test feature behaviour --
every handler here is still the generated stub. They check three things the
development sprint can then build on without re-checking: the app starts,
the OpenAPI document lists the approved contract, and session-protected
routes actually reject an unauthenticated request.
"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_openapi_lists_the_approved_endpoints() -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    for path in [
        "/auth/login",
        "/auth/callback",
        "/auth/logout",
        "/me",
        "/documents",
        "/documents/{document_id}/file",
        "/answer",
        "/answer/stop",
        "/conversations",
        "/conversations/{conversation_id}",
        "/messages/{message_id}/feedback",
    ]:
        assert path in paths, path


def test_protected_routes_reject_unauthenticated_requests() -> None:
    for method, path in [
        ("get", "/me"),
        ("get", "/documents"),
        ("get", "/conversations"),
        ("post", "/conversations"),
    ]:
        response = getattr(client, method)(path)
        assert response.status_code == 401
