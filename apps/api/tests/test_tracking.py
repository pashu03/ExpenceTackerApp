from __future__ import annotations

from httpx import AsyncClient

from tests.test_auth import REGISTER_PAYLOAD, csrf_headers, register


async def test_core_records_are_created_updated_listed_and_deleted(client: AsyncClient) -> None:
    await register(client)
    headers = csrf_headers(client)

    expense_response = await client.post(
        "/api/v1/expenses",
        headers=headers,
        json={
            "amount": "650.00",
            "category": "Food & Dining",
            "description": "Dinner",
            "spent_on": "2026-08-25",
        },
    )
    assert expense_response.status_code == 201, expense_response.text
    expense_id = expense_response.json()["data"]["id"]
    updated_expense = await client.patch(
        f"/api/v1/expenses/{expense_id}",
        headers=headers,
        json={"amount": "600.00", "notes": "Shared with friends"},
    )
    assert updated_expense.status_code == 200
    assert updated_expense.json()["data"]["amount"] == "600.00"

    income_response = await client.post(
        "/api/v1/income",
        headers=headers,
        json={"amount": "50000", "source": "Salary", "received_on": "2026-08-01"},
    )
    assert income_response.status_code == 201, income_response.text
    income_id = income_response.json()["data"]["id"]

    journal_response = await client.post(
        "/api/v1/journal",
        headers=headers,
        json={
            "entry_date": "2026-08-25",
            "title": "A social evening",
            "content": "Met friends after work and went for dinner.",
            "mood": "Happy",
        },
    )
    assert journal_response.status_code == 201, journal_response.text
    journal_id = journal_response.json()["data"]["id"]

    goal_response = await client.post(
        "/api/v1/goals",
        headers=headers,
        json={
            "name": "Laptop",
            "target_amount": "100000",
            "current_amount": "25000",
            "target_date": "2027-12-31",
        },
    )
    assert goal_response.status_code == 201, goal_response.text
    goal_id = goal_response.json()["data"]["id"]
    assert goal_response.json()["data"]["progress_percentage"] == "25.0"

    summary = await client.get("/api/v1/dashboard/summary?month=2026-08")
    assert summary.status_code == 200, summary.text
    data = summary.json()["data"]
    assert data["income"] == "50000.00"
    assert data["expenses"] == "600.00"
    assert data["net_savings"] == "49400.00"
    assert data["categories"][0]["category"] == "Food & Dining"
    assert data["suggestions"]

    assert (
        await client.delete(f"/api/v1/expenses/{expense_id}", headers=headers)
    ).status_code == 200
    assert (
        await client.delete(f"/api/v1/income/{income_id}", headers=headers)
    ).status_code == 200
    assert (
        await client.delete(f"/api/v1/journal/{journal_id}", headers=headers)
    ).status_code == 200
    assert (
        await client.delete(f"/api/v1/goals/{goal_id}", headers=headers)
    ).status_code == 200


async def test_journal_allows_only_one_entry_per_day(client: AsyncClient) -> None:
    await register(client)
    headers = csrf_headers(client)
    payload = {"entry_date": "2026-08-25", "content": "A useful day."}
    assert (await client.post("/api/v1/journal", headers=headers, json=payload)).status_code == 201

    duplicate = await client.post("/api/v1/journal", headers=headers, json=payload)

    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "JOURNAL_DATE_EXISTS"


async def test_other_user_cannot_modify_an_owned_expense(client: AsyncClient) -> None:
    await register(client)
    response = await client.post(
        "/api/v1/expenses",
        headers=csrf_headers(client),
        json={"amount": "100", "category": "Travel", "spent_on": "2026-08-25"},
    )
    expense_id = response.json()["data"]["id"]
    await client.post("/api/v1/auth/logout", headers=csrf_headers(client))

    second_user = {
        **REGISTER_PAYLOAD,
        "email": "second@example.com",
        "name": "Second User",
    }
    assert (await client.post("/api/v1/auth/register", json=second_user)).status_code == 201

    denied = await client.patch(
        f"/api/v1/expenses/{expense_id}",
        headers=csrf_headers(client),
        json={"amount": "1"},
    )

    assert denied.status_code == 404
    assert denied.json()["code"] == "RESOURCE_NOT_FOUND"
