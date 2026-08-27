from __future__ import annotations

from httpx import AsyncClient

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
