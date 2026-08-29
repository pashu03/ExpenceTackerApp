from __future__ import annotations

import uuid
from calendar import monthrange
from datetime import date, datetime
from decimal import ROUND_CEILING, ROUND_HALF_UP, Decimal
from typing import Any, TypeVar
from zoneinfo import ZoneInfo

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from lifetracker.core.errors import AppError
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
    BudgetRead,
    BudgetUpdate,
    CategoryTotal,
    DailyTotal,
    ExpenseInput,
    ExpenseRead,
    ExpenseUpdate,
    GoalInput,
    GoalProjection,
    GoalRead,
    GoalUpdate,
    IncomeInput,
    IncomeUpdate,
    JournalInput,
    JournalUpdate,
    MonthlySummary,
    ReminderInput,
    ReminderUpdate,
    SpendingSuggestion,
)

ModelT = TypeVar("ModelT", Expense, Income, JournalEntry, FinancialGoal, Budget, Reminder)


def month_bounds(month: str | None) -> tuple[str, date, date]:
    try:
        selected = date.fromisoformat(f"{month}-01") if month else date.today().replace(day=1)
    except ValueError as exc:
        raise AppError(
            status_code=422,
            code="INVALID_MONTH",
            title="Invalid month",
            detail="Month must use the YYYY-MM format.",
        ) from exc
    last_day = monthrange(selected.year, selected.month)[1]
    return selected.strftime("%Y-%m"), selected, selected.replace(day=last_day)


class TrackingService:
    def __init__(self, session: AsyncSession, user_id: uuid.UUID, timezone: str = "UTC") -> None:
        self.session = session
        self.user_id = user_id
        self.timezone = timezone

    async def _owned(self, model: type[ModelT], entity_id: uuid.UUID) -> ModelT:
        result = await self.session.execute(
            select(model).where(model.id == entity_id, model.user_id == self.user_id)
        )
        entity = result.scalar_one_or_none()
        if entity is None:
            raise AppError(
                status_code=404,
                code="RESOURCE_NOT_FOUND",
                title="Record not found",
                detail="This record does not exist or you do not have access to it.",
            )
        return entity

    async def _list(self, query: Select[tuple[ModelT]]) -> list[ModelT]:
        return list((await self.session.scalars(query)).all())

    async def list_expenses(self, month: str | None) -> list[Expense]:
        _, start, end = month_bounds(month)
        return await self._list(
            select(Expense)
            .where(
                Expense.user_id == self.user_id,
                Expense.spent_on >= start,
                Expense.spent_on <= end,
            )
            .order_by(Expense.spent_on.desc(), Expense.created_at.desc())
        )

    async def create_expense(self, payload: ExpenseInput) -> Expense:
        entity = Expense(user_id=self.user_id, **payload.model_dump())
        self.session.add(entity)
        await self.session.commit()
        await self.session.refresh(entity)
        return entity

    async def update_expense(self, entity_id: uuid.UUID, payload: ExpenseUpdate) -> Expense:
        return await self._update(
            await self._owned(Expense, entity_id), payload.model_dump(exclude_unset=True)
        )

    async def list_income(self, month: str | None) -> list[Income]:
        _, start, end = month_bounds(month)
        return await self._list(
            select(Income)
            .where(
                Income.user_id == self.user_id,
                Income.received_on >= start,
                Income.received_on <= end,
            )
            .order_by(Income.received_on.desc(), Income.created_at.desc())
        )

    async def create_income(self, payload: IncomeInput) -> Income:
        entity = Income(user_id=self.user_id, **payload.model_dump())
        self.session.add(entity)
        await self.session.commit()
        await self.session.refresh(entity)
        return entity

    async def update_income(self, entity_id: uuid.UUID, payload: IncomeUpdate) -> Income:
        return await self._update(
            await self._owned(Income, entity_id), payload.model_dump(exclude_unset=True)
        )

    async def list_journal(self) -> list[JournalEntry]:
        return await self._list(
            select(JournalEntry)
            .where(JournalEntry.user_id == self.user_id)
            .order_by(JournalEntry.entry_date.desc())
        )

    async def create_journal(self, payload: JournalInput) -> JournalEntry:
        existing = await self.session.scalar(
            select(JournalEntry).where(
                JournalEntry.user_id == self.user_id,
                JournalEntry.entry_date == payload.entry_date,
            )
        )
        if existing:
            raise AppError(
                status_code=409,
                code="JOURNAL_DATE_EXISTS",
                title="Journal already exists",
                detail="You already have a journal entry for this day. Edit it instead.",
            )
        entity = JournalEntry(user_id=self.user_id, **payload.model_dump())
        self.session.add(entity)
        await self.session.commit()
        await self.session.refresh(entity)
        return entity

    async def update_journal(self, entity_id: uuid.UUID, payload: JournalUpdate) -> JournalEntry:
        return await self._update(
            await self._owned(JournalEntry, entity_id), payload.model_dump(exclude_unset=True)
        )

    async def list_goals(self) -> list[FinancialGoal]:
        return await self._list(
            select(FinancialGoal)
            .where(FinancialGoal.user_id == self.user_id)
            .order_by(FinancialGoal.created_at.desc())
        )

    async def create_goal(self, payload: GoalInput) -> FinancialGoal:
        entity = FinancialGoal(user_id=self.user_id, **payload.model_dump())
        self.session.add(entity)
        await self.session.commit()
        await self.session.refresh(entity)
        return entity

    async def update_goal(self, entity_id: uuid.UUID, payload: GoalUpdate) -> FinancialGoal:
        entity = await self._owned(FinancialGoal, entity_id)
        values = payload.model_dump(exclude_unset=True)
        target = values.get("target_amount", entity.target_amount)
        current = values.get("current_amount", entity.current_amount)
        if current >= target:
            values["status"] = "completed"
        elif values.get("status") == "completed" and current < target:
            raise AppError(
                status_code=422,
                code="GOAL_NOT_FUNDED",
                title="Goal is not fully funded",
                detail="A goal can be completed after its saved amount reaches the target.",
            )
        return await self._update(entity, values)

    async def list_budgets(self, month: str | None) -> list[BudgetRead]:
        month_name, _, _ = month_bounds(month)
        budgets = await self._list(
            select(Budget)
            .where(Budget.user_id == self.user_id, Budget.month == month_name)
            .order_by(Budget.category.asc())
        )
        expenses = await self.list_expenses(month_name)
        spent: dict[str, Decimal] = {}
        for expense in expenses:
            spent[expense.category] = spent.get(expense.category, Decimal("0")) + expense.amount
        return [self.budget_read(item, spent.get(item.category, Decimal("0"))) for item in budgets]

    async def create_budget(self, payload: BudgetInput) -> BudgetRead:
        entity = Budget(user_id=self.user_id, **payload.model_dump())
        self.session.add(entity)
        await self.session.commit()
        await self.session.refresh(entity)
        return self.budget_read(entity, await self._category_spend(entity.month, entity.category))

    async def update_budget(self, entity_id: uuid.UUID, payload: BudgetUpdate) -> BudgetRead:
        entity = await self._update(
            await self._owned(Budget, entity_id), payload.model_dump(exclude_unset=True)
        )
        return self.budget_read(entity, await self._category_spend(entity.month, entity.category))

    async def _category_spend(self, month: str, category: str) -> Decimal:
        return sum(
            (item.amount for item in await self.list_expenses(month) if item.category == category),
            Decimal("0"),
        )

    @staticmethod
    def budget_read(entity: Budget, spent: Decimal) -> BudgetRead:
        remaining = entity.limit_amount - spent
        usage = (spent / entity.limit_amount * 100).quantize(Decimal("0.1"))
        return BudgetRead.model_validate(entity).model_copy(
            update={
                "spent_amount": spent,
                "remaining_amount": remaining,
                "usage_percentage": usage,
            }
        )

    async def list_reminders(self, month: str | None) -> list[Reminder]:
        query = select(Reminder).where(Reminder.user_id == self.user_id)
        if month:
            _, start, end = month_bounds(month)
            query = query.where(Reminder.due_on >= start, Reminder.due_on <= end)
        return await self._list(query.order_by(Reminder.completed.asc(), Reminder.due_on.asc()))

    async def create_reminder(self, payload: ReminderInput) -> Reminder:
        entity = Reminder(user_id=self.user_id, **payload.model_dump())
        self.session.add(entity)
        await self.session.commit()
        await self.session.refresh(entity)
        return entity

    async def update_reminder(self, entity_id: uuid.UUID, payload: ReminderUpdate) -> Reminder:
        return await self._update(
            await self._owned(Reminder, entity_id), payload.model_dump(exclude_unset=True)
        )

    async def delete(self, model: type[ModelT], entity_id: uuid.UUID) -> None:
        await self.session.delete(await self._owned(model, entity_id))
        await self.session.commit()

    async def _update(self, entity: ModelT, values: dict[str, Any]) -> ModelT:
        for field, value in values.items():
            setattr(entity, field, value)
        await self.session.commit()
        await self.session.refresh(entity)
        return entity

    @staticmethod
    def goal_read(entity: FinancialGoal) -> GoalRead:
        remaining = max(entity.target_amount - entity.current_amount, Decimal("0"))
        progress = min(
            (entity.current_amount / entity.target_amount * 100).quantize(Decimal("0.1")),
            Decimal("100"),
        )
        return GoalRead.model_validate(entity).model_copy(
            update={"remaining_amount": remaining, "progress_percentage": progress}
        )

    async def monthly_summary(self, month: str | None) -> MonthlySummary:
        month_name, _, _ = month_bounds(month)
        expenses = await self.list_expenses(month_name)
        incomes = await self.list_income(month_name)
        goals = await self.list_goals()
        total_expenses = sum((item.amount for item in expenses), Decimal("0"))
        total_income = sum((item.amount for item in incomes), Decimal("0"))
        net = total_income - total_expenses
        savings_rate = None
        if total_income > 0:
            savings_rate = (net / total_income * 100).quantize(Decimal("0.1"))

        category_amounts: dict[str, Decimal] = {}
        daily_amounts: dict[date, Decimal] = {}
        for item in expenses:
            category_amounts[item.category] = (
                category_amounts.get(item.category, Decimal("0")) + item.amount
            )
            daily_amounts[item.spent_on] = (
                daily_amounts.get(item.spent_on, Decimal("0")) + item.amount
            )
        categories = [
            CategoryTotal(
                category=category,
                amount=amount,
                percentage=(amount / total_expenses * 100).quantize(Decimal("0.1"))
                if total_expenses
                else Decimal("0"),
            )
            for category, amount in sorted(
                category_amounts.items(), key=lambda item: item[1], reverse=True
            )
        ]
        (
            goal_projections,
            available_after_expenses,
            planned_goal_contributions,
            recommended_spending_limit,
        ) = self._goal_projections(goals, total_income, total_expenses)
        suggestions = self._suggestions(
            total_income,
            total_expenses,
            categories,
            goal_projections,
            available_after_expenses,
            planned_goal_contributions,
        )
        return MonthlySummary(
            month=month_name,
            income=total_income,
            expenses=total_expenses,
            net_savings=net,
            savings_rate=savings_rate,
            available_after_expenses=available_after_expenses,
            planned_goal_contributions=planned_goal_contributions,
            recommended_spending_limit=recommended_spending_limit,
            today_expenses=daily_amounts.get(
                datetime.now(ZoneInfo(self.timezone)).date(), Decimal("0")
            ),
            active_goals=sum(goal.status == "active" for goal in goals),
            categories=categories,
            daily_spending=[
                DailyTotal(date=day, amount=amount) for day, amount in sorted(daily_amounts.items())
            ],
            recent_expenses=[ExpenseRead.model_validate(item) for item in expenses[:5]],
            suggestions=suggestions,
            goal_projections=goal_projections,
        )

    @staticmethod
    def _goal_projections(
        goals: list[FinancialGoal], income: Decimal, expenses: Decimal
    ) -> tuple[list[GoalProjection], Decimal, Decimal, Decimal]:
        active = [
            goal
            for goal in goals
            if goal.status == "active" and goal.current_amount < goal.target_amount
        ]
        available = max(income - expenses, Decimal("0"))
        planned = sum((goal.monthly_contribution for goal in active), Decimal("0"))
        unconfigured_count = sum(goal.monthly_contribution <= 0 for goal in active)
        configured_plan = sum(
            (goal.monthly_contribution for goal in active if goal.monthly_contribution > 0),
            Decimal("0"),
        )
        unallocated = max(available - min(configured_plan, available), Decimal("0"))
        unconfigured_share = (
            (unallocated / unconfigured_count).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            if unconfigured_count
            else Decimal("0")
        )
        spending_limit = max(income - planned, Decimal("0"))
        projections: list[GoalProjection] = []

        for goal in active:
            remaining = max(goal.target_amount - goal.current_amount, Decimal("0"))
            contribution = goal.monthly_contribution
            if contribution <= 0:
                recommended = min(unconfigured_share, remaining)
            elif planned <= available:
                recommended = min(contribution, remaining)
            elif planned > 0:
                recommended = min(
                    (contribution * available / planned).quantize(
                        Decimal("0.01"), rounding=ROUND_HALF_UP
                    ),
                    remaining,
                )
            else:
                recommended = Decimal("0")
            estimated_days: int | None = None
            estimated_months: int | None = None
            if contribution > 0:
                months = remaining / contribution
                estimated_months = int(months.to_integral_value(rounding=ROUND_CEILING))
                estimated_days = int(
                    (months * Decimal("30.44")).to_integral_value(rounding=ROUND_CEILING)
                )

            income_percentage = None
            if income > 0:
                income_percentage = (contribution / income * 100).quantize(Decimal("0.1"))

            if income <= 0:
                status = "needs_income"
                recommendation = (
                    "Add this month's income before using the affordability estimate."
                )
            elif contribution <= 0:
                status = "not_configured"
                recommendation = (
                    f"Set a monthly contribution. Up to {recommended:.2f} is currently "
                    f"available for this goal after expenses and other goal plans."
                    if recommended > 0
                    else "Set a contribution after income is higher than recorded expenses."
                )
            elif planned > available:
                status = "overcommitted"
                reduction = max(contribution - recommended, Decimal("0"))
                recommendation = (
                    f"Based on current income and expenses, reduce this goal's monthly plan "
                    f"by about {reduction:.2f}, to {recommended:.2f}."
                )
            else:
                status = "on_track"
                recommendation = (
                    f"The planned {contribution:.2f} per month fits within current income "
                    "after expenses."
                )

            projections.append(
                GoalProjection(
                    goal_id=goal.id,
                    name=goal.name,
                    remaining_amount=remaining,
                    monthly_contribution=contribution,
                    recommended_monthly_contribution=recommended,
                    estimated_days=estimated_days,
                    estimated_months=estimated_months,
                    income_percentage=income_percentage,
                    affordability_status=status,
                    recommendation=recommendation,
                )
            )

        return projections, available, planned, spending_limit

    @staticmethod
    def _suggestions(
        income: Decimal,
        expenses: Decimal,
        categories: list[CategoryTotal],
        goal_projections: list[GoalProjection],
        available: Decimal,
        planned: Decimal,
    ) -> list[SpendingSuggestion]:
        if expenses == 0:
            result = [
                SpendingSuggestion(
                    type="info",
                    title="Add a few expenses",
                    description="Record your spending to receive monthly saving suggestions.",
                )
            ]
        else:
            result = []
        if income == 0:
            result.append(
                SpendingSuggestion(
                    type="info",
                    title="Add this month's income",
                    description=(
                        "Income helps LifeTracker calculate your savings and spending balance."
                    ),
                )
            )
        elif expenses > income:
            result.append(
                SpendingSuggestion(
                    type="warning",
                    title="Spending is above income",
                    description=(
                        "Review your largest categories first to bring this month's cash flow "
                        "back above zero."
                    ),
                    potential_monthly_saving=expenses - income,
                )
            )

        discretionary = {
            "Food & Dining",
            "Shopping",
            "Entertainment",
            "Travel",
            "Subscriptions",
            "Personal Care",
        }
        candidate = next((item for item in categories if item.category in discretionary), None)
        if candidate:
            reduction = (candidate.amount * Decimal("0.10")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            result.append(
                SpendingSuggestion(
                    type="opportunity",
                    title=f"Review {candidate.category}",
                    description=(
                        f"{candidate.category} is {candidate.percentage}% of this month's "
                        "spending. A 10% reduction is a practical starting target."
                    ),
                    potential_monthly_saving=reduction,
                )
            )
        elif categories:
            largest = categories[0]
            result.append(
                SpendingSuggestion(
                    type="info",
                    title="Review your largest category",
                    description=(
                        f"{largest.category} is {largest.percentage}% of this month's spending. "
                        "Check whether any part is flexible before making changes."
                    ),
                )
            )
        if income > 0 and expenses <= income:
            result.append(
                SpendingSuggestion(
                    type="positive",
                    title="Protect your monthly surplus",
                    description=(
                        "Consider moving part of your current surplus toward an active goal."
                    ),
                    potential_monthly_saving=income - expenses,
                )
            )
        if goal_projections and planned == 0:
            result.append(
                SpendingSuggestion(
                    type="info",
                    title="Plan a monthly goal contribution",
                    description=(
                        "Choose how much of your monthly income to reserve for each active goal."
                    ),
                )
            )
        elif goal_projections and planned > available:
            result.append(
                SpendingSuggestion(
                    type="warning",
                    title="Goal plan exceeds available cash",
                    description=(
                        "Your planned goal contributions are higher than income after this "
                        "month's recorded expenses."
                    ),
                    potential_monthly_saving=planned - available,
                )
            )
        return result[:3]
