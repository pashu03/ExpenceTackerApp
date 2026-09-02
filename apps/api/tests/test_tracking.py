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
            "monthly_contribution": "5000",
            "target_date": "2027-12-31",
        },
    )
    assert goal_response.status_code == 201, goal_response.text
    goal_id = goal_response.json()["data"]["id"]
    assert goal_response.json()["data"]["progress_percentage"] == "25.0"
    assert goal_response.json()["data"]["monthly_contribution"] == "5000.00"

    summary = await client.get("/api/v1/dashboard/summary?month=2026-08")
    assert summary.status_code == 200, summary.text
    data = summary.json()["data"]
    assert data["income"] == "50000.00"
    assert data["expenses"] == "600.00"
    assert data["net_savings"] == "49400.00"
    assert data["available_after_expenses"] == "49400.00"
    assert data["planned_goal_contributions"] == "5000.00"
    assert data["recommended_spending_limit"] == "45000.00"
    assert data["goal_projections"][0]["recommended_monthly_contribution"] == "5000.00"
    assert data["goal_projections"][0]["estimated_months"] == 15
    assert data["goal_projections"][0]["estimated_days"] == 457
    assert data["goal_projections"][0]["affordability_status"] == "on_track"
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


async def test_expenses_can_be_filtered_to_one_day_within_a_month(client: AsyncClient) -> None:
    await register(client)
    headers = csrf_headers(client)
    for amount, spent_on in (("120", "2026-08-03"), ("80", "2026-08-03"), ("500", "2026-08-04")):
        response = await client.post(
            "/api/v1/expenses",
            headers=headers,
            json={"amount": amount, "category": "Food & Dining", "spent_on": spent_on},
        )
        assert response.status_code == 201, response.text

    response = await client.get("/api/v1/expenses?month=2026-08&spent_on=2026-08-03")

    assert response.status_code == 200, response.text
    assert {item["amount"] for item in response.json()["data"]} == {"80.00", "120.00"}
    assert {item["spent_on"] for item in response.json()["data"]} == {"2026-08-03"}


async def test_goal_plan_reacts_to_income_expenses_and_contribution(client: AsyncClient) -> None:
    await register(client)
    headers = csrf_headers(client)
    assert (
        await client.post(
            "/api/v1/income",
            headers=headers,
            json={"amount": "10000", "source": "Salary", "received_on": "2026-08-01"},
        )
    ).status_code == 201
    assert (
        await client.post(
            "/api/v1/expenses",
            headers=headers,
            json={"amount": "7000", "category": "Rent", "spent_on": "2026-08-02"},
        )
    ).status_code == 201
    goal = await client.post(
        "/api/v1/goals",
        headers=headers,
        json={
            "name": "Emergency fund",
            "target_amount": "12000",
            "monthly_contribution": "4000",
        },
    )
    assert goal.status_code == 201, goal.text

    summary = await client.get("/api/v1/analytics/monthly?month=2026-08")

    assert summary.status_code == 200, summary.text
    data = summary.json()["data"]
    assert data["available_after_expenses"] == "3000.00"
    assert data["planned_goal_contributions"] == "4000.00"
    assert data["recommended_spending_limit"] == "6000.00"
    projection = data["goal_projections"][0]
    assert projection["recommended_monthly_contribution"] == "3000.00"
    assert projection["estimated_months"] == 3
    assert projection["estimated_days"] == 92
    assert projection["income_percentage"] == "40.0"
    assert projection["affordability_status"] == "overcommitted"


async def test_goal_recommendations_share_available_cash_proportionally(
    client: AsyncClient,
) -> None:
    await register(client)
    headers = csrf_headers(client)
    await client.post(
        "/api/v1/income",
        headers=headers,
        json={"amount": "10000", "source": "Salary", "received_on": "2026-08-01"},
    )
    await client.post(
        "/api/v1/expenses",
        headers=headers,
        json={"amount": "4000", "category": "Rent", "spent_on": "2026-08-02"},
    )
    for name, contribution in (("Laptop", "6000"), ("Emergency fund", "3000")):
        response = await client.post(
            "/api/v1/goals",
            headers=headers,
            json={
                "name": name,
                "target_amount": "50000",
                "monthly_contribution": contribution,
            },
        )
        assert response.status_code == 201, response.text

    summary = await client.get("/api/v1/dashboard/summary?month=2026-08")
    projections = {
        item["name"]: item for item in summary.json()["data"]["goal_projections"]
    }

    assert projections["Laptop"]["recommended_monthly_contribution"] == "4000.00"
    assert projections["Emergency fund"]["recommended_monthly_contribution"] == "2000.00"
    assert all(item["affordability_status"] == "overcommitted" for item in projections.values())


async def test_latest_salary_is_used_for_planning_without_changing_recorded_income(
    client: AsyncClient,
) -> None:
    await register(client)
    headers = csrf_headers(client)
    salary = await client.post(
        "/api/v1/income",
        headers=headers,
        json={"amount": "30000", "source": "Salary", "received_on": "2026-09-07"},
    )
    assert salary.status_code == 201, salary.text
    goal = await client.post(
        "/api/v1/goals",
        headers=headers,
        json={
            "name": "Bike",
            "target_amount": "200000",
            "current_amount": "50000",
            "monthly_contribution": "5000",
        },
    )
    assert goal.status_code == 201, goal.text

    summary = await client.get("/api/v1/dashboard/summary?month=2026-08")
    assert summary.status_code == 200, summary.text
    data = summary.json()["data"]

    assert data["income"] == "0"
    assert data["planning_income"] == "30000.00"
    assert data["income_basis"] == "latest_salary"
    assert data["latest_salary_date"] == "2026-09-07"
    assert data["goal_projections"][0]["estimated_months"] == 30
    assert data["goal_projections"][0]["income_percentage"] == "16.7"
    assert data["goal_projections"][0]["priority_rank"] == 1
    assert data["salary_allocation"]["goal_savings"] == "5000.00"
    assert data["salary_allocation"]["emergency_fund"] == "3000.00"
    assert data["safe_to_spend"] == "22000.00"
    assert 0 <= data["financial_health"]["score"] <= 100

    duplicate = await client.post(
        "/api/v1/income",
        headers=headers,
        json={"amount": "30000", "source": "salary", "received_on": "2026-09-07"},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "DUPLICATE_INCOME"


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


async def test_budgets_include_actual_spending_and_support_crud(client: AsyncClient) -> None:
    await register(client)
    headers = csrf_headers(client)
    await client.post(
        "/api/v1/expenses",
        headers=headers,
        json={
            "amount": "250.00",
            "category": "Food & Dining",
            "spent_on": "2026-08-25",
        },
    )
    created = await client.post(
        "/api/v1/budgets",
        headers=headers,
        json={
            "month": "2026-08",
            "category": "Food & Dining",
            "limit_amount": "1000.00",
        },
    )
    assert created.status_code == 201, created.text
    budget_id = created.json()["data"]["id"]
    assert created.json()["data"]["spent_amount"] == "250.00"
    assert created.json()["data"]["usage_percentage"] == "25.0"

    listed = await client.get("/api/v1/budgets?month=2026-08")
    assert listed.json()["data"][0]["remaining_amount"] == "750.00"

    updated = await client.patch(
        f"/api/v1/budgets/{budget_id}",
        headers=headers,
        json={"limit_amount": "500.00"},
    )
    assert updated.status_code == 200
    assert updated.json()["data"]["usage_percentage"] == "50.0"
    assert (await client.delete(f"/api/v1/budgets/{budget_id}", headers=headers)).status_code == 200


async def test_reminders_support_create_complete_and_delete(client: AsyncClient) -> None:
    await register(client)
    headers = csrf_headers(client)
    created = await client.post(
        "/api/v1/reminders",
        headers=headers,
        json={"title": "Pay electricity bill", "due_on": "2026-08-28", "kind": "expense"},
    )
    assert created.status_code == 201, created.text
    reminder_id = created.json()["data"]["id"]

    listed = await client.get("/api/v1/reminders?month=2026-08")
    assert listed.json()["data"][0]["title"] == "Pay electricity bill"

    completed = await client.patch(
        f"/api/v1/reminders/{reminder_id}", headers=headers, json={"completed": True}
    )
    assert completed.status_code == 200
    assert completed.json()["data"]["completed"] is True
    assert (
        await client.delete(f"/api/v1/reminders/{reminder_id}", headers=headers)
    ).status_code == 200
