from __future__ import annotations

from httpx import AsyncClient

from tests.test_auth import csrf_headers, register


async def test_user_can_update_profile_and_preferences(client: AsyncClient) -> None:
    await register(client)

    response = await client.put(
        "/api/v1/settings",
        headers=csrf_headers(client),
        json={
            "name": "Aarav S. Sharma",
            "currency_code": "usd",
            "timezone": "America/New_York",
            "financial_month_start": 5,
            "notifications_enabled": False,
            "ai_insights_enabled": True,
            "journal_ai_enabled": False,
            "theme": "dark",
        },
    )

    assert response.status_code == 200, response.text
    user = response.json()["data"]
    assert user["name"] == "Aarav S. Sharma"
    assert user["preferences"] == {
        "currency_code": "USD",
        "timezone": "America/New_York",
        "ai_insights_enabled": True,
        "journal_ai_enabled": False,
        "notifications_enabled": False,
        "theme": "dark",
        "financial_month_start": 5,
    }

    current_user = await client.get("/api/v1/auth/me")
    assert current_user.json()["data"]["preferences"]["currency_code"] == "USD"


async def test_settings_reject_invalid_timezone(client: AsyncClient) -> None:
    await register(client)

    response = await client.put(
        "/api/v1/settings",
        headers=csrf_headers(client),
        json={
            "name": "Aarav Sharma",
            "currency_code": "INR",
            "timezone": "Not/A-Timezone",
            "financial_month_start": 1,
            "notifications_enabled": True,
            "ai_insights_enabled": False,
            "journal_ai_enabled": False,
            "theme": "system",
        },
    )

    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"
