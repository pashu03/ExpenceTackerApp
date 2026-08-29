from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from sqlalchemy.exc import ProgrammingError

from lifetracker.core.config import Settings
from lifetracker.features.auth.service import AuthService

REGISTER_PAYLOAD = {
    "name": "Aarav Sharma",
    "email": "aarav@example.com",
    "password": "securepass123",
}


async def register(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)
    assert response.status_code == 201, response.text


def csrf_headers(client: AsyncClient) -> dict[str, str]:
    token = client.cookies.get("lifetracker_csrf")
    assert token
    return {"X-CSRF-Token": token}


async def test_registration_sets_session_and_returns_current_user(client: AsyncClient) -> None:
    await register(client)

    response = await client.get("/api/v1/auth/me")

    assert response.status_code == 200
    assert response.json()["data"]["email"] == "aarav@example.com"
    assert response.json()["data"]["preferences"]["currency_code"] == "INR"
    assert "lifetracker_access" in client.cookies
    assert "lifetracker_refresh" in client.cookies


async def test_duplicate_registration_is_rejected(client: AsyncClient) -> None:
    await register(client)

    response = await client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)

    assert response.status_code == 409
    assert response.json()["code"] == "EMAIL_ALREADY_REGISTERED"


async def test_registration_rejects_uppercase_email(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json={**REGISTER_PAYLOAD, "email": "Aarav@example.com"},
    )

    assert response.status_code == 422


async def test_registration_requires_eight_character_password(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json={**REGISTER_PAYLOAD, "password": "abc1234"},
    )

    assert response.status_code == 422


async def test_registration_accepts_eight_character_password(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json={**REGISTER_PAYLOAD, "password": "abcde123"},
    )

    assert response.status_code == 201


async def test_login_rejects_invalid_password_without_revealing_account(
    client: AsyncClient,
) -> None:
    await register(client)
    await client.post("/api/v1/auth/logout", headers=csrf_headers(client))

    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "aarav@example.com", "password": "incorrect-password"},
    )

    assert response.status_code == 401
    assert response.json()["code"] == "INVALID_CREDENTIALS"


async def test_refresh_rotates_session_and_logout_blocks_access(client: AsyncClient) -> None:
    await register(client)
    old_refresh = client.cookies.get("lifetracker_refresh")

    refresh_response = await client.post("/api/v1/auth/refresh", headers=csrf_headers(client))

    assert refresh_response.status_code == 200
    assert client.cookies.get("lifetracker_refresh") != old_refresh

    logout_response = await client.post("/api/v1/auth/logout", headers=csrf_headers(client))
    me_response = await client.get("/api/v1/auth/me")

    assert logout_response.status_code == 200
    assert me_response.status_code == 401


async def test_unsafe_authenticated_request_requires_csrf(client: AsyncClient) -> None:
    await register(client)

    response = await client.post("/api/v1/auth/logout")

    assert response.status_code == 403
    assert response.json()["code"] == "CSRF_VALIDATION_FAILED"


async def test_unauthenticated_user_cannot_access_protected_endpoint(client: AsyncClient) -> None:
    response = await client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.json()["code"] == "INVALID_SESSION"


async def test_password_reset_uses_one_time_code_and_revokes_sessions(client: AsyncClient) -> None:
    await register(client)

    requested = await client.post(
        "/api/v1/auth/forgot-password", json={"email": REGISTER_PAYLOAD["email"]}
    )
    assert requested.status_code == 200
    code = requested.json()["data"]["development_code"]
    assert len(code) == 6

    reset = await client.post(
        "/api/v1/auth/reset-password",
        json={
            "email": REGISTER_PAYLOAD["email"],
            "code": code,
            "new_password": "newsecure456",
        },
    )
    assert reset.status_code == 200, reset.text
    assert (await client.get("/api/v1/auth/me")).status_code == 401

    reused = await client.post(
        "/api/v1/auth/reset-password",
        json={
            "email": REGISTER_PAYLOAD["email"],
            "code": code,
            "new_password": "another789",
        },
    )
    assert reused.status_code == 400

    login = await client.post(
        "/api/v1/auth/login",
        json={"email": REGISTER_PAYLOAD["email"], "password": "newsecure456"},
    )
    assert login.status_code == 200


async def test_forgot_password_does_not_reveal_unknown_email(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/forgot-password", json={"email": "unknown@example.com"}
    )

    assert response.status_code == 200
    assert response.json()["data"]["development_code"] is None


async def test_login_is_rate_limited_after_repeated_failures(client: AsyncClient) -> None:
    await register(client)
    await client.post("/api/v1/auth/logout", headers=csrf_headers(client))

    for _ in range(5):
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": REGISTER_PAYLOAD["email"], "password": "wrong-password"},
        )
        assert response.status_code == 401

    blocked = await client.post(
        "/api/v1/auth/login",
        json={"email": REGISTER_PAYLOAD["email"], "password": REGISTER_PAYLOAD["password"]},
    )
    assert blocked.status_code == 429
    assert blocked.json()["code"] == "LOGIN_RATE_LIMITED"


async def test_missing_login_attempt_table_disables_rate_limit_without_crashing() -> None:
    class MissingTableError(Exception):
        sqlstate = "42P01"

    session = AsyncMock()
    settings = Settings(
        environment="test",
        database_url="sqlite+aiosqlite://",
        jwt_secret="test-secret-that-is-longer-than-thirty-two-characters",
    )
    service = AuthService(session, settings)
    service.repository.get_login_attempt_for_update = AsyncMock(
        side_effect=ProgrammingError("SELECT", {}, MissingTableError("missing table"))
    )

    _, attempt, available = await service._login_limit("person@example.com", "127.0.0.1")

    assert attempt is None
    assert available is False
    session.rollback.assert_awaited_once()


async def test_login_rate_limit_does_not_hide_other_database_errors() -> None:
    class PermissionDeniedError(Exception):
        sqlstate = "42501"

    session = AsyncMock()
    settings = Settings(
        environment="test",
        database_url="sqlite+aiosqlite://",
        jwt_secret="test-secret-that-is-longer-than-thirty-two-characters",
    )
    service = AuthService(session, settings)
    error = ProgrammingError("SELECT", {}, PermissionDeniedError("permission denied"))
    service.repository.get_login_attempt_for_update = AsyncMock(side_effect=error)

    with pytest.raises(ProgrammingError) as raised:
        await service._login_limit("person@example.com", "127.0.0.1")

    assert raised.value is error
    session.rollback.assert_not_awaited()


async def test_change_password_revokes_session(client: AsyncClient) -> None:
    await register(client)

    changed = await client.post(
        "/api/v1/auth/change-password",
        headers=csrf_headers(client),
        json={
            "current_password": REGISTER_PAYLOAD["password"],
            "new_password": "changedpass456",
        },
    )
    assert changed.status_code == 200, changed.text
    assert (await client.get("/api/v1/auth/me")).status_code == 401

    login = await client.post(
        "/api/v1/auth/login",
        json={"email": REGISTER_PAYLOAD["email"], "password": "changedpass456"},
    )
    assert login.status_code == 200


async def test_delete_account_removes_user_and_allows_fresh_registration(
    client: AsyncClient,
) -> None:
    await register(client)

    deleted = await client.post(
        "/api/v1/auth/delete-account",
        headers=csrf_headers(client),
        json={"password": REGISTER_PAYLOAD["password"], "confirmation": "DELETE"},
    )
    assert deleted.status_code == 200, deleted.text
    assert (await client.get("/api/v1/auth/me")).status_code == 401
    assert (await client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)).status_code == 201
