from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class EntityResponse[T](BaseModel):
    data: T


class ListResponse[T](BaseModel):
    data: list[T]


class MessageData(BaseModel):
    message: str


class MessageResponse(BaseModel):
    data: MessageData


class ExpenseInput(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    category: str = Field(min_length=1, max_length=60)
    description: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=2000)
    spent_on: date

    @field_validator("category")
    @classmethod
    def normalize_category(cls, value: str) -> str:
        return " ".join(value.split())


class ExpenseUpdate(BaseModel):
    amount: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=2)
    category: str | None = Field(default=None, min_length=1, max_length=60)
    description: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=2000)
    spent_on: date | None = None

    @field_validator("category")
    @classmethod
    def normalize_category(cls, value: str | None) -> str | None:
        return " ".join(value.split()) if value else value


class ExpenseRead(ExpenseInput):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class IncomeInput(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    source: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=200)
    received_on: date

    @field_validator("source")
    @classmethod
    def normalize_source(cls, value: str) -> str:
        return " ".join(value.split())


class IncomeUpdate(BaseModel):
    amount: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=2)
    source: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=200)
    received_on: date | None = None

    @field_validator("source")
    @classmethod
    def normalize_source(cls, value: str | None) -> str | None:
        return " ".join(value.split()) if value else value


class IncomeRead(IncomeInput):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class JournalInput(BaseModel):
    entry_date: date
    title: str | None = Field(default=None, max_length=120)
    content: str = Field(min_length=1, max_length=10000)
    mood: str | None = Field(default=None, max_length=30)

    @field_validator("content")
    @classmethod
    def content_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Journal content cannot be blank")
        return value


class JournalUpdate(BaseModel):
    entry_date: date | None = None
    title: str | None = Field(default=None, max_length=120)
    content: str | None = Field(default=None, min_length=1, max_length=10000)
    mood: str | None = Field(default=None, max_length=30)

    @field_validator("content")
    @classmethod
    def content_must_not_be_blank(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("Journal content cannot be blank")
        return value


class JournalRead(JournalInput):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class GoalInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=300)
    target_amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    current_amount: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=2)
    monthly_contribution: Decimal = Field(
        default=Decimal("0"), ge=0, max_digits=14, decimal_places=2
    )
    target_date: date | None = None
    status: str = Field(default="active", pattern="^(active|completed|paused)$")

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Goal name cannot be blank")
        return value

    @model_validator(mode="after")
    def complete_goal_when_funded(self) -> GoalInput:
        if self.current_amount >= self.target_amount:
            self.status = "completed"
        return self


class GoalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=300)
    target_amount: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=2)
    current_amount: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    monthly_contribution: Decimal | None = Field(
        default=None, ge=0, max_digits=14, decimal_places=2
    )
    target_date: date | None = None
    status: str | None = Field(default=None, pattern="^(active|completed|paused)$")

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        return " ".join(value.split()) if value else value


class GoalRead(GoalInput):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    progress_percentage: Decimal = Decimal("0")
    remaining_amount: Decimal = Decimal("0")
    created_at: datetime
    updated_at: datetime


class BudgetInput(BaseModel):
    month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    category: str = Field(min_length=1, max_length=60)
    limit_amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    notes: str | None = Field(default=None, max_length=300)

    @field_validator("category")
    @classmethod
    def normalize_category(cls, value: str) -> str:
        return " ".join(value.split())


class BudgetUpdate(BaseModel):
    month: str | None = Field(default=None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    category: str | None = Field(default=None, min_length=1, max_length=60)
    limit_amount: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=2)
    notes: str | None = Field(default=None, max_length=300)

    @field_validator("category")
    @classmethod
    def normalize_category(cls, value: str | None) -> str | None:
        return " ".join(value.split()) if value else value


class BudgetRead(BudgetInput):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    spent_amount: Decimal = Decimal("0")
    remaining_amount: Decimal = Decimal("0")
    usage_percentage: Decimal = Decimal("0")
    created_at: datetime
    updated_at: datetime


class ReminderInput(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    due_on: date
    kind: str = Field(default="general", pattern="^(general|expense|goal|journal|income)$")
    completed: bool = False

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Reminder title cannot be blank")
        return value


class ReminderUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    due_on: date | None = None
    kind: str | None = Field(default=None, pattern="^(general|expense|goal|journal|income)$")
    completed: bool | None = None

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str | None) -> str | None:
        return " ".join(value.split()) if value else value


class ReminderRead(ReminderInput):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class CategoryTotal(BaseModel):
    category: str
    amount: Decimal
    percentage: Decimal


class DailyTotal(BaseModel):
    date: date
    amount: Decimal


class SpendingSuggestion(BaseModel):
    type: str
    title: str
    description: str
    potential_monthly_saving: Decimal | None = None


class SalaryAllocation(BaseModel):
    essential_expenses: Decimal
    goal_savings: Decimal
    emergency_fund: Decimal
    flexible_spending: Decimal
    total_allocated: Decimal
    unallocated: Decimal


class SpendingAlert(BaseModel):
    severity: str
    title: str
    description: str
    category: str | None = None


class SpendingForecast(BaseModel):
    projected_monthly_spending: Decimal
    historical_monthly_average: Decimal
    variance_percentage: Decimal | None
    months_analyzed: int
    alerts: list[SpendingAlert]


class FinancialHealth(BaseModel):
    score: int = Field(ge=0, le=100)
    label: str
    cash_flow: int = Field(ge=0, le=30)
    spending_control: int = Field(ge=0, le=25)
    emergency_readiness: int = Field(ge=0, le=20)
    goal_planning: int = Field(ge=0, le=15)
    tracking_consistency: int = Field(ge=0, le=10)


class GoalProjection(BaseModel):
    goal_id: uuid.UUID
    name: str
    remaining_amount: Decimal
    monthly_contribution: Decimal
    recommended_monthly_contribution: Decimal
    estimated_days: int | None
    estimated_months: int | None
    income_percentage: Decimal | None
    affordability_status: str
    recommendation: str
    priority_rank: int
    priority_reason: str


class MonthlySummary(BaseModel):
    month: str
    income: Decimal
    planning_income: Decimal
    income_basis: str
    latest_salary_amount: Decimal | None
    latest_salary_date: date | None
    expenses: Decimal
    net_savings: Decimal
    savings_rate: Decimal | None
    available_after_expenses: Decimal
    planned_goal_contributions: Decimal
    recommended_spending_limit: Decimal
    safe_to_spend: Decimal
    salary_allocation: SalaryAllocation
    spending_forecast: SpendingForecast
    financial_health: FinancialHealth
    today_expenses: Decimal
    active_goals: int
    categories: list[CategoryTotal]
    daily_spending: list[DailyTotal]
    recent_expenses: list[ExpenseRead]
    suggestions: list[SpendingSuggestion]
    goal_projections: list[GoalProjection]


ExpenseResponse = EntityResponse[ExpenseRead]
ExpenseListResponse = ListResponse[ExpenseRead]
IncomeResponse = EntityResponse[IncomeRead]
IncomeListResponse = ListResponse[IncomeRead]
JournalResponse = EntityResponse[JournalRead]
JournalListResponse = ListResponse[JournalRead]
GoalResponse = EntityResponse[GoalRead]
GoalListResponse = ListResponse[GoalRead]
BudgetResponse = EntityResponse[BudgetRead]
BudgetListResponse = ListResponse[BudgetRead]
ReminderResponse = EntityResponse[ReminderRead]
ReminderListResponse = ListResponse[ReminderRead]
MonthlySummaryResponse = EntityResponse[MonthlySummary]
