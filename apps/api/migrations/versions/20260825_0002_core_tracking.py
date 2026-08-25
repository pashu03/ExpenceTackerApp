"""Create core tracking records.

Revision ID: 20260825_0002
Revises: 20260825_0001
Create Date: 2026-08-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260825_0002"
down_revision: str | None = "20260825_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def timestamps() -> list[sa.Column[object]]:
    return [
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
    ]


def upgrade() -> None:
    op.create_table(
        "expenses",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("category", sa.String(60), nullable=False),
        sa.Column("description", sa.String(200), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("spent_on", sa.Date(), nullable=False),
        *timestamps(),
        sa.CheckConstraint("amount > 0", name="ck_expenses_positive_amount"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_expenses_user_date", "expenses", ["user_id", "spent_on"])

    op.create_table(
        "income_transactions",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("source", sa.String(100), nullable=False),
        sa.Column("description", sa.String(200), nullable=True),
        sa.Column("received_on", sa.Date(), nullable=False),
        *timestamps(),
        sa.CheckConstraint("amount > 0", name="ck_income_positive_amount"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_income_user_date", "income_transactions", ["user_id", "received_on"])

    op.create_table(
        "journal_entries",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("title", sa.String(120), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("mood", sa.String(30), nullable=True),
        *timestamps(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "entry_date", name="uq_journal_user_date"),
    )
    op.create_index("ix_journal_user_date", "journal_entries", ["user_id", "entry_date"])

    op.create_table(
        "financial_goals",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.String(300), nullable=True),
        sa.Column("target_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("current_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        *timestamps(),
        sa.CheckConstraint("target_amount > 0", name="ck_goals_positive_target"),
        sa.CheckConstraint("current_amount >= 0", name="ck_goals_nonnegative_current"),
        sa.CheckConstraint("status IN ('active', 'completed', 'paused')", name="ck_goals_status"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_goals_user_status", "financial_goals", ["user_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_goals_user_status", table_name="financial_goals")
    op.drop_table("financial_goals")
    op.drop_index("ix_journal_user_date", table_name="journal_entries")
    op.drop_table("journal_entries")
    op.drop_index("ix_income_user_date", table_name="income_transactions")
    op.drop_table("income_transactions")
    op.drop_index("ix_expenses_user_date", table_name="expenses")
    op.drop_table("expenses")
