from __future__ import annotations

import uuid
from calendar import monthrange
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, TypeVar

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from lifetracker.core.errors import AppError
from lifetracker.features.tracking.models import Expense, FinancialGoal, Income, JournalEntry
from lifetracker.features.tracking.schemas import (
    CategoryTotal,
    DailyTotal,
    ExpenseInput,
    ExpenseRead,
    ExpenseUpdate,
    GoalInput,
    GoalRead,
    GoalUpdate,
    IncomeInput,
    IncomeUpdate,
    JournalInput,
    JournalUpdate,
    MonthlySummary,
    SpendingSuggestion,
)

ModelT = TypeVar("ModelT", Expense, Income, JournalEntry, FinancialGoal)


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
    def __init__(self, session: AsyncSession, user_id: uuid.UUID) -> None:
        self.session = session
        self.user_id = user_id

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
        suggestions = self._suggestions(total_income, total_expenses, categories)
        return MonthlySummary(
            month=month_name,
            income=total_income,
            expenses=total_expenses,
            net_savings=net,
            savings_rate=savings_rate,
            today_expenses=daily_amounts.get(date.today(), Decimal("0")),
            active_goals=sum(goal.status == "active" for goal in goals),
            categories=categories,
            daily_spending=[
                DailyTotal(date=day, amount=amount) for day, amount in sorted(daily_amounts.items())
            ],
            recent_expenses=[ExpenseRead.model_validate(item) for item in expenses[:5]],
            suggestions=suggestions,
        )

    @staticmethod
    def _suggestions(
        income: Decimal, expenses: Decimal, categories: list[CategoryTotal]
    ) -> list[SpendingSuggestion]:
        if expenses == 0:
            return [
                SpendingSuggestion(
                    type="info",
                    title="Add a few expenses",
                    description="Record your spending to receive monthly saving suggestions.",
                )
            ]
        result: list[SpendingSuggestion] = []
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
        else:
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
        return result[:3]
