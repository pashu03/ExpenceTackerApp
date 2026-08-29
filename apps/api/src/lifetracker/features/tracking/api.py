from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from lifetracker.features.auth.dependencies import CurrentUser, SessionDependency
from lifetracker.features.tracking.models import (
    Budget,
    Expense,
    FinancialGoal,
    Income,
    JournalEntry,
    Reminder,
)
from lifetracker.features.tracking.schemas import (
    BudgetInput,
    BudgetListResponse,
    BudgetResponse,
    BudgetUpdate,
    ExpenseInput,
    ExpenseListResponse,
    ExpenseRead,
    ExpenseResponse,
    ExpenseUpdate,
    GoalInput,
    GoalListResponse,
    GoalResponse,
    GoalUpdate,
    IncomeInput,
    IncomeListResponse,
    IncomeRead,
    IncomeResponse,
    IncomeUpdate,
    JournalInput,
    JournalListResponse,
    JournalRead,
    JournalResponse,
    JournalUpdate,
    MessageData,
    MessageResponse,
    MonthlySummaryResponse,
    ReminderInput,
    ReminderListResponse,
    ReminderRead,
    ReminderResponse,
    ReminderUpdate,
)
from lifetracker.features.tracking.service import TrackingService

router = APIRouter(tags=["tracking"])
MonthQuery = Annotated[str | None, Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")]


def service(session: SessionDependency, current_user: CurrentUser) -> TrackingService:
    return TrackingService(session, current_user.id, current_user.preferences.timezone)


@router.get("/expenses", response_model=ExpenseListResponse)
async def list_expenses(
    session: SessionDependency, current_user: CurrentUser, month: MonthQuery = None
) -> ExpenseListResponse:
    items = await service(session, current_user).list_expenses(month)
    return ExpenseListResponse(data=[ExpenseRead.model_validate(item) for item in items])


@router.post("/expenses", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_expense(
    payload: ExpenseInput, session: SessionDependency, current_user: CurrentUser
) -> ExpenseResponse:
    item = await service(session, current_user).create_expense(payload)
    return ExpenseResponse(data=ExpenseRead.model_validate(item))


@router.patch("/expenses/{entity_id}", response_model=ExpenseResponse)
async def update_expense(
    entity_id: uuid.UUID,
    payload: ExpenseUpdate,
    session: SessionDependency,
    current_user: CurrentUser,
) -> ExpenseResponse:
    item = await service(session, current_user).update_expense(entity_id, payload)
    return ExpenseResponse(data=ExpenseRead.model_validate(item))


@router.delete("/expenses/{entity_id}", response_model=MessageResponse)
async def delete_expense(
    entity_id: uuid.UUID, session: SessionDependency, current_user: CurrentUser
) -> MessageResponse:
    await service(session, current_user).delete(Expense, entity_id)
    return MessageResponse(data=MessageData(message="Expense deleted."))


@router.get("/income", response_model=IncomeListResponse)
async def list_income(
    session: SessionDependency, current_user: CurrentUser, month: MonthQuery = None
) -> IncomeListResponse:
    items = await service(session, current_user).list_income(month)
    return IncomeListResponse(data=[IncomeRead.model_validate(item) for item in items])


@router.post("/income", response_model=IncomeResponse, status_code=status.HTTP_201_CREATED)
async def create_income(
    payload: IncomeInput, session: SessionDependency, current_user: CurrentUser
) -> IncomeResponse:
    item = await service(session, current_user).create_income(payload)
    return IncomeResponse(data=IncomeRead.model_validate(item))


@router.patch("/income/{entity_id}", response_model=IncomeResponse)
async def update_income(
    entity_id: uuid.UUID,
    payload: IncomeUpdate,
    session: SessionDependency,
    current_user: CurrentUser,
) -> IncomeResponse:
    item = await service(session, current_user).update_income(entity_id, payload)
    return IncomeResponse(data=IncomeRead.model_validate(item))


@router.delete("/income/{entity_id}", response_model=MessageResponse)
async def delete_income(
    entity_id: uuid.UUID, session: SessionDependency, current_user: CurrentUser
) -> MessageResponse:
    await service(session, current_user).delete(Income, entity_id)
    return MessageResponse(data=MessageData(message="Income deleted."))


@router.get("/journal", response_model=JournalListResponse)
async def list_journal(
    session: SessionDependency, current_user: CurrentUser
) -> JournalListResponse:
    items = await service(session, current_user).list_journal()
    return JournalListResponse(data=[JournalRead.model_validate(item) for item in items])


@router.post("/journal", response_model=JournalResponse, status_code=status.HTTP_201_CREATED)
async def create_journal(
    payload: JournalInput, session: SessionDependency, current_user: CurrentUser
) -> JournalResponse:
    item = await service(session, current_user).create_journal(payload)
    return JournalResponse(data=JournalRead.model_validate(item))


@router.patch("/journal/{entity_id}", response_model=JournalResponse)
async def update_journal(
    entity_id: uuid.UUID,
    payload: JournalUpdate,
    session: SessionDependency,
    current_user: CurrentUser,
) -> JournalResponse:
    item = await service(session, current_user).update_journal(entity_id, payload)
    return JournalResponse(data=JournalRead.model_validate(item))


@router.delete("/journal/{entity_id}", response_model=MessageResponse)
async def delete_journal(
    entity_id: uuid.UUID, session: SessionDependency, current_user: CurrentUser
) -> MessageResponse:
    await service(session, current_user).delete(JournalEntry, entity_id)
    return MessageResponse(data=MessageData(message="Journal entry deleted."))


@router.get("/goals", response_model=GoalListResponse)
async def list_goals(session: SessionDependency, current_user: CurrentUser) -> GoalListResponse:
    tracking = service(session, current_user)
    items = await tracking.list_goals()
    return GoalListResponse(data=[tracking.goal_read(item) for item in items])


@router.post("/goals", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
async def create_goal(
    payload: GoalInput, session: SessionDependency, current_user: CurrentUser
) -> GoalResponse:
    tracking = service(session, current_user)
    return GoalResponse(data=tracking.goal_read(await tracking.create_goal(payload)))


@router.patch("/goals/{entity_id}", response_model=GoalResponse)
async def update_goal(
    entity_id: uuid.UUID,
    payload: GoalUpdate,
    session: SessionDependency,
    current_user: CurrentUser,
) -> GoalResponse:
    tracking = service(session, current_user)
    return GoalResponse(data=tracking.goal_read(await tracking.update_goal(entity_id, payload)))


@router.delete("/goals/{entity_id}", response_model=MessageResponse)
async def delete_goal(
    entity_id: uuid.UUID, session: SessionDependency, current_user: CurrentUser
) -> MessageResponse:
    await service(session, current_user).delete(FinancialGoal, entity_id)
    return MessageResponse(data=MessageData(message="Goal deleted."))


@router.get("/budgets", response_model=BudgetListResponse)
async def list_budgets(
    session: SessionDependency, current_user: CurrentUser, month: MonthQuery = None
) -> BudgetListResponse:
    return BudgetListResponse(data=await service(session, current_user).list_budgets(month))


@router.post("/budgets", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
async def create_budget(
    payload: BudgetInput, session: SessionDependency, current_user: CurrentUser
) -> BudgetResponse:
    return BudgetResponse(data=await service(session, current_user).create_budget(payload))


@router.patch("/budgets/{entity_id}", response_model=BudgetResponse)
async def update_budget(
    entity_id: uuid.UUID,
    payload: BudgetUpdate,
    session: SessionDependency,
    current_user: CurrentUser,
) -> BudgetResponse:
    return BudgetResponse(
        data=await service(session, current_user).update_budget(entity_id, payload)
    )


@router.delete("/budgets/{entity_id}", response_model=MessageResponse)
async def delete_budget(
    entity_id: uuid.UUID, session: SessionDependency, current_user: CurrentUser
) -> MessageResponse:
    await service(session, current_user).delete(Budget, entity_id)
    return MessageResponse(data=MessageData(message="Budget deleted."))


@router.get("/reminders", response_model=ReminderListResponse)
async def list_reminders(
    session: SessionDependency, current_user: CurrentUser, month: MonthQuery = None
) -> ReminderListResponse:
    items = await service(session, current_user).list_reminders(month)
    return ReminderListResponse(data=[ReminderRead.model_validate(item) for item in items])


@router.post("/reminders", response_model=ReminderResponse, status_code=status.HTTP_201_CREATED)
async def create_reminder(
    payload: ReminderInput, session: SessionDependency, current_user: CurrentUser
) -> ReminderResponse:
    item = await service(session, current_user).create_reminder(payload)
    return ReminderResponse(data=ReminderRead.model_validate(item))


@router.patch("/reminders/{entity_id}", response_model=ReminderResponse)
async def update_reminder(
    entity_id: uuid.UUID,
    payload: ReminderUpdate,
    session: SessionDependency,
    current_user: CurrentUser,
) -> ReminderResponse:
    item = await service(session, current_user).update_reminder(entity_id, payload)
    return ReminderResponse(data=ReminderRead.model_validate(item))


@router.delete("/reminders/{entity_id}", response_model=MessageResponse)
async def delete_reminder(
    entity_id: uuid.UUID, session: SessionDependency, current_user: CurrentUser
) -> MessageResponse:
    await service(session, current_user).delete(Reminder, entity_id)
    return MessageResponse(data=MessageData(message="Reminder deleted."))


@router.get("/dashboard/summary", response_model=MonthlySummaryResponse)
@router.get("/analytics/monthly", response_model=MonthlySummaryResponse)
async def monthly_summary(
    session: SessionDependency, current_user: CurrentUser, month: MonthQuery = None
) -> MonthlySummaryResponse:
    return MonthlySummaryResponse(data=await service(session, current_user).monthly_summary(month))
