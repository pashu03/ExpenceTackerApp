from __future__ import annotations

import uuid
from calendar import monthrange
from datetime import date, datetime
from decimal import ROUND_CEILING, ROUND_HALF_UP, Decimal
from typing import Any, TypeVar
from zoneinfo import ZoneInfo

from sqlalchemy import Select, func, select
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
    FinancialHealth,
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
    SalaryAllocation,
    SpendingAlert,
    SpendingForecast,
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


def shift_month(value: date, offset: int) -> date:
    month_index = value.year * 12 + value.month - 1 + offset
    return date(month_index // 12, month_index % 12 + 1, 1)


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

    async def latest_salary(self) -> Income | None:
        return await self.session.scalar(
            select(Income)
            .where(
                Income.user_id == self.user_id,
                func.lower(Income.source).like("%salary%"),
            )
            .order_by(Income.received_on.desc(), Income.created_at.desc())
            .limit(1)
        )

    async def expense_history(self, before: date, months: int = 3) -> list[Expense]:
        return await self._list(
            select(Expense)
            .where(
                Expense.user_id == self.user_id,
                Expense.spent_on >= shift_month(before, -months),
                Expense.spent_on < before,
            )
            .order_by(Expense.spent_on.asc())
        )

    async def create_income(self, payload: IncomeInput) -> Income:
        duplicate = await self.session.scalar(
            select(Income.id).where(
                Income.user_id == self.user_id,
                Income.received_on == payload.received_on,
                Income.amount == payload.amount,
                func.lower(Income.source) == payload.source.lower(),
            )
        )
        if duplicate:
            raise AppError(
                status_code=409,
                code="DUPLICATE_INCOME",
                title="Income already recorded",
                detail=(
                    "The same income amount, source, and date already exist. "
                    "Edit the existing record instead."
                ),
            )
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
        month_name, month_start, month_end = month_bounds(month)
        expenses = await self.list_expenses(month_name)
        incomes = await self.list_income(month_name)
        goals = await self.list_goals()
        latest_salary = await self.latest_salary()
        history = await self.expense_history(month_start)
        total_expenses = sum((item.amount for item in expenses), Decimal("0"))
        total_income = sum((item.amount for item in incomes), Decimal("0"))
        latest_salary_amount = latest_salary.amount if latest_salary else Decimal("0")
        planning_income = max(total_income, latest_salary_amount)
        income_basis = (
            "latest_salary"
            if latest_salary and latest_salary_amount > total_income
            else "recorded_month"
        )
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
        ) = self._goal_projections(goals, planning_income, total_expenses)
        today = datetime.now(ZoneInfo(self.timezone)).date()
        forecast = self._spending_forecast(
            expenses,
            history,
            month_start,
            month_end,
            today,
        )
        allocation, extra_emergency_saving = self._salary_allocation(
            planning_income,
            total_expenses,
            forecast.projected_monthly_spending,
            expenses,
            goals,
        )
        safe_to_spend = max(
            planning_income
            - max(total_expenses, forecast.projected_monthly_spending)
            - planned_goal_contributions
            - extra_emergency_saving,
            Decimal("0"),
        )
        financial_health = self._financial_health(
            planning_income,
            forecast,
            goals,
            history,
        )
        suggestions = self._suggestions(
            planning_income,
            total_expenses,
            categories,
            goal_projections,
            available_after_expenses,
            planned_goal_contributions,
        )
        return MonthlySummary(
            month=month_name,
            income=total_income,
            planning_income=planning_income,
            income_basis=income_basis,
            latest_salary_amount=latest_salary.amount if latest_salary else None,
            latest_salary_date=latest_salary.received_on if latest_salary else None,
            expenses=total_expenses,
            net_savings=net,
            savings_rate=savings_rate,
            available_after_expenses=available_after_expenses,
            planned_goal_contributions=planned_goal_contributions,
            recommended_spending_limit=recommended_spending_limit,
            safe_to_spend=safe_to_spend,
            salary_allocation=allocation,
            spending_forecast=forecast,
            financial_health=financial_health,
            today_expenses=daily_amounts.get(
                today, Decimal("0")
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
    def _spending_forecast(
        expenses: list[Expense],
        history: list[Expense],
        month_start: date,
        month_end: date,
        today: date,
    ) -> SpendingForecast:
        current_total = sum((item.amount for item in expenses), Decimal("0"))
        history_total = sum((item.amount for item in history), Decimal("0"))
        months_analyzed = len({item.spent_on.strftime("%Y-%m") for item in history})
        historical_average = (history_total / Decimal("3")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        if month_start <= today <= month_end and today.day > 0:
            pace = Decimal(month_end.day) / Decimal(today.day)
            projected = (current_total * pace).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        elif month_end < today:
            pace = Decimal("1")
            projected = current_total
        else:
            pace = Decimal("0")
            projected = Decimal("0")

        variance = None
        if historical_average > 0:
            variance = (
                (projected - historical_average) / historical_average * Decimal("100")
            ).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)

        alerts: list[SpendingAlert] = []
        if months_analyzed >= 2 and variance is not None and variance > Decimal("10"):
            alerts.append(
                SpendingAlert(
                    severity="warning",
                    title="Monthly spending is trending high",
                    description=(
                        f"Projected spending is {variance}% above the previous three-month "
                        "calendar average."
                    ),
                )
            )

        history_categories: dict[str, Decimal] = {}
        current_categories: dict[str, Decimal] = {}
        for item in history:
            history_categories[item.category] = (
                history_categories.get(item.category, Decimal("0")) + item.amount
            )
        for item in expenses:
            current_categories[item.category] = (
                current_categories.get(item.category, Decimal("0")) + item.amount
            )
        if months_analyzed >= 2 and pace > 0:
            for category, amount in current_categories.items():
                usual = history_categories.get(category, Decimal("0")) / Decimal("3")
                projected_category = amount * pace
                if usual > 0 and projected_category > usual * Decimal("1.25"):
                    difference = (
                        (projected_category - usual) / usual * Decimal("100")
                    ).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
                    alerts.append(
                        SpendingAlert(
                            severity="warning",
                            title=f"{category} is above its usual pace",
                            description=(
                                f"{category} is projected to be {difference}% above its "
                                "previous three-month average."
                            ),
                            category=category,
                        )
                    )

        return SpendingForecast(
            projected_monthly_spending=projected,
            historical_monthly_average=historical_average,
            variance_percentage=variance,
            months_analyzed=months_analyzed,
            alerts=alerts[:5],
        )

    @staticmethod
    def _salary_allocation(
        income: Decimal,
        expenses: Decimal,
        projected_expenses: Decimal,
        expense_items: list[Expense],
        goals: list[FinancialGoal],
    ) -> tuple[SalaryAllocation, Decimal]:
        essential_categories = {
            "Groceries",
            "Fuel",
            "Rent",
            "Utilities",
            "Healthcare",
            "Education",
            "Family",
            "EMI / Loans",
            "Insurance",
        }
        essential_recorded = sum(
            (item.amount for item in expense_items if item.category in essential_categories),
            Decimal("0"),
        )
        expense_scale = projected_expenses / expenses if expenses > 0 else Decimal("0")
        essential = (essential_recorded * expense_scale).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        active = [
            goal
            for goal in goals
            if goal.status == "active" and goal.current_amount < goal.target_amount
        ]
        emergency_goals = [
            goal
            for goal in active
            if "emergency" in goal.name.lower() or "rainy day" in goal.name.lower()
        ]
        emergency_contribution = sum(
            (goal.monthly_contribution for goal in emergency_goals), Decimal("0")
        )
        goal_savings = sum(
            (
                goal.monthly_contribution
                for goal in active
                if goal not in emergency_goals
            ),
            Decimal("0"),
        )
        extra_emergency = Decimal("0")
        if income > 0 and emergency_contribution <= 0:
            extra_emergency = min(
                (income * Decimal("0.10")).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                ),
                max(income - essential - goal_savings, Decimal("0")),
            )
        emergency_fund = emergency_contribution or extra_emergency
        committed = essential + goal_savings + emergency_fund
        flexible = max(income - committed, Decimal("0"))
        total = committed + flexible
        return (
            SalaryAllocation(
                essential_expenses=essential,
                goal_savings=goal_savings,
                emergency_fund=emergency_fund,
                flexible_spending=flexible,
                total_allocated=total,
                unallocated=max(income - total, Decimal("0")),
            ),
            extra_emergency,
        )

    @staticmethod
    def _financial_health(
        income: Decimal,
        forecast: SpendingForecast,
        goals: list[FinancialGoal],
        history: list[Expense],
    ) -> FinancialHealth:
        projected = forecast.projected_monthly_spending
        if income > 0:
            surplus_rate = max((income - projected) / income, Decimal("0"))
            cash_flow = min(int(surplus_rate / Decimal("0.30") * 30), 30)
            expense_rate = projected / income
            spending_control = min(max(int((Decimal("1") - expense_rate) * 50), 0), 25)
        else:
            cash_flow = 0
            spending_control = 0

        active = [goal for goal in goals if goal.status == "active"]
        configured = sum(goal.monthly_contribution > 0 for goal in active)
        goal_planning = int(configured / len(active) * 15) if active else 5
        emergency = next(
            (
                goal
                for goal in active
                if "emergency" in goal.name.lower() or "rainy day" in goal.name.lower()
            ),
            None,
        )
        if emergency:
            progress = min(emergency.current_amount / emergency.target_amount, Decimal("1"))
            emergency_readiness = int(progress * 15) + (
                5 if emergency.monthly_contribution > 0 else 0
            )
        else:
            emergency_readiness = 0
        tracked_months = len({item.spent_on.strftime("%Y-%m") for item in history})
        tracking_consistency = min(round(tracked_months / 3 * 10), 10)
        score = min(
            cash_flow
            + spending_control
            + emergency_readiness
            + goal_planning
            + tracking_consistency,
            100,
        )
        label = (
            "Excellent"
            if score >= 85
            else "Good"
            if score >= 70
            else "Fair"
            if score >= 50
            else "Needs attention"
        )
        return FinancialHealth(
            score=score,
            label=label,
            cash_flow=cash_flow,
            spending_control=spending_control,
            emergency_readiness=emergency_readiness,
            goal_planning=goal_planning,
            tracking_consistency=tracking_consistency,
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
        priority_order = sorted(
            active,
            key=lambda goal: (
                0
                if "emergency" in goal.name.lower() or "rainy day" in goal.name.lower()
                else 1,
                goal.target_date or date.max,
                goal.target_amount - goal.current_amount,
            ),
        )
        priority_ranks = {goal.id: index + 1 for index, goal in enumerate(priority_order)}
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

            if "emergency" in goal.name.lower() or "rainy day" in goal.name.lower():
                priority_reason = "Prioritized to build protection against unexpected expenses."
            elif goal.target_date:
                priority_reason = "Prioritized using the goal's target date and remaining amount."
            elif remaining <= available and remaining > 0:
                priority_reason = "A smaller remaining balance makes this a practical quick win."
            else:
                priority_reason = "Ranked after urgent and emergency goals."

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
                    priority_rank=priority_ranks[goal.id],
                    priority_reason=priority_reason,
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
