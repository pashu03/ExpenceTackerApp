from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lifetracker.features.tracking.models import (
    Budget,
    Expense,
    FinancialGoal,
    Income,
    JournalEntry,
    Reminder,
)
from lifetracker.features.tracking.schemas import (
    BudgetRead,
    ExpenseRead,
    GoalRead,
    IncomeRead,
    JournalRead,
    ReminderRead,
)
from lifetracker.features.users.models import User
from lifetracker.features.users.schemas import SettingsUpdateRequest, UserRead


class UserSettingsService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def update(self, user: User, request: SettingsUpdateRequest) -> User:
        user.name = request.name
        user.preferences.currency_code = request.currency_code
        user.preferences.timezone = request.timezone
        user.preferences.financial_month_start = request.financial_month_start
        user.preferences.notifications_enabled = request.notifications_enabled
        user.preferences.ai_insights_enabled = request.ai_insights_enabled
        user.preferences.journal_ai_enabled = request.journal_ai_enabled
        user.preferences.theme = request.theme
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def export(self, user: User) -> dict[str, object]:
        expenses = list(
            (await self.session.scalars(select(Expense).where(Expense.user_id == user.id))).all()
        )
        income = list(
            (await self.session.scalars(select(Income).where(Income.user_id == user.id))).all()
        )
        journal = list(
            (
                await self.session.scalars(
                    select(JournalEntry).where(JournalEntry.user_id == user.id)
                )
            ).all()
        )
        goals = list(
            (
                await self.session.scalars(
                    select(FinancialGoal).where(FinancialGoal.user_id == user.id)
                )
            ).all()
        )
        budgets = list(
            (await self.session.scalars(select(Budget).where(Budget.user_id == user.id))).all()
        )
        reminders = list(
            (await self.session.scalars(select(Reminder).where(Reminder.user_id == user.id))).all()
        )

        goal_exports = []
        for item in goals:
            remaining = max(item.target_amount - item.current_amount, Decimal("0"))
            progress = min(
                (item.current_amount / item.target_amount * 100).quantize(Decimal("0.1")),
                Decimal("100"),
            )
            goal_exports.append(
                GoalRead.model_validate(item)
                .model_copy(
                    update={"progress_percentage": progress, "remaining_amount": remaining}
                )
                .model_dump(mode="json")
            )

        spending: dict[tuple[str, str], Decimal] = {}
        for item in expenses:
            key = (item.spent_on.strftime("%Y-%m"), item.category)
            spending[key] = spending.get(key, Decimal("0")) + item.amount
        budget_exports = []
        for item in budgets:
            spent = spending.get((item.month, item.category), Decimal("0"))
            remaining = item.limit_amount - spent
            usage = (spent / item.limit_amount * 100).quantize(Decimal("0.1"))
            budget_exports.append(
                BudgetRead.model_validate(item)
                .model_copy(
                    update={
                        "spent_amount": spent,
                        "remaining_amount": remaining,
                        "usage_percentage": usage,
                    }
                )
                .model_dump(mode="json")
            )
        return {
            "exported_at": datetime.now(UTC).isoformat(),
            "format_version": 1,
            "profile": UserRead.model_validate(user).model_dump(mode="json"),
            "expenses": [
                ExpenseRead.model_validate(item).model_dump(mode="json") for item in expenses
            ],
            "income": [
                IncomeRead.model_validate(item).model_dump(mode="json") for item in income
            ],
            "journal_entries": [
                JournalRead.model_validate(item).model_dump(mode="json") for item in journal
            ],
            "financial_goals": goal_exports,
            "budgets": budget_exports,
            "reminders": [
                ReminderRead.model_validate(item).model_dump(mode="json") for item in reminders
            ],
        }
