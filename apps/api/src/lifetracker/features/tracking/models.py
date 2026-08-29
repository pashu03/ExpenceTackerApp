from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from lifetracker.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Expense(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "expenses"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    category: Mapped[str] = mapped_column(String(60), nullable=False)
    description: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    spent_on: Mapped[date] = mapped_column(Date, nullable=False)

    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_expenses_positive_amount"),
        Index("ix_expenses_user_date", "user_id", "spent_on"),
    )


class Income(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "income_transactions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    source: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(200), nullable=True)
    received_on: Mapped[date] = mapped_column(Date, nullable=False)

    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_income_positive_amount"),
        Index("ix_income_user_date", "user_id", "received_on"),
    )


class JournalEntry(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "journal_entries"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    title: Mapped[str | None] = mapped_column(String(120), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    mood: Mapped[str | None] = mapped_column(String(30), nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "entry_date", name="uq_journal_user_date"),
        Index("ix_journal_user_date", "user_id", "entry_date"),
    )


class FinancialGoal(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "financial_goals"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(String(300), nullable=True)
    target_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    current_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    monthly_contribution: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=0
    )
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")

    __table_args__ = (
        CheckConstraint("target_amount > 0", name="ck_goals_positive_target"),
        CheckConstraint("current_amount >= 0", name="ck_goals_nonnegative_current"),
        CheckConstraint(
            "monthly_contribution >= 0", name="ck_goals_nonnegative_monthly_contribution"
        ),
        CheckConstraint("status IN ('active', 'completed', 'paused')", name="ck_goals_status"),
        Index("ix_goals_user_status", "user_id", "status"),
    )


class Budget(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "budgets"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    month: Mapped[str] = mapped_column(String(7), nullable=False)
    category: Mapped[str] = mapped_column(String(60), nullable=False)
    limit_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(String(300), nullable=True)

    __table_args__ = (
        CheckConstraint("limit_amount > 0", name="ck_budgets_positive_limit"),
        UniqueConstraint("user_id", "month", "category", name="uq_budget_user_month_category"),
        Index("ix_budgets_user_month", "user_id", "month"),
    )


class Reminder(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "reminders"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    due_on: Mapped[date] = mapped_column(Date, nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False, default="general")
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    __table_args__ = (
        CheckConstraint(
            "kind IN ('general', 'expense', 'goal', 'journal', 'income')",
            name="ck_reminders_kind",
        ),
        Index("ix_reminders_user_due", "user_id", "due_on", "completed"),
    )
