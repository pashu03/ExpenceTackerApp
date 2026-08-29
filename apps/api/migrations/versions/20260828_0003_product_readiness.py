"""Add password recovery, login protection, budgets, and reminders.

Revision ID: 20260828_0003
Revises: 20260825_0002
Create Date: 2026-08-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260828_0003"
down_revision: str | None = "20260825_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def identity_columns() -> list[sa.Column[object]]:
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
        "password_reset_challenges",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("requester_hash", sa.String(length=64), nullable=True),
        *identity_columns(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_password_reset_email_active",
        "password_reset_challenges",
        ["email", "consumed_at", "expires_at"],
    )

    op.create_table(
        "login_attempts",
        sa.Column("key_hash", sa.String(length=64), nullable=False),
        sa.Column("failure_count", sa.Integer(), nullable=False),
        sa.Column("window_started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("blocked_until", sa.DateTime(timezone=True), nullable=True),
        *identity_columns(),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key_hash"),
    )

    op.create_table(
        "budgets",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("month", sa.String(length=7), nullable=False),
        sa.Column("category", sa.String(length=60), nullable=False),
        sa.Column("limit_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("notes", sa.String(length=300), nullable=True),
        *identity_columns(),
        sa.CheckConstraint("limit_amount > 0", name="ck_budgets_positive_limit"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "month", "category", name="uq_budget_user_month_category"),
    )
    op.create_index("ix_budgets_user_month", "budgets", ["user_id", "month"])

    op.create_table(
        "reminders",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("due_on", sa.Date(), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("completed", sa.Boolean(), nullable=False),
        *identity_columns(),
        sa.CheckConstraint(
            "kind IN ('general', 'expense', 'goal', 'journal', 'income')",
            name="ck_reminders_kind",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_reminders_user_due",
        "reminders",
        ["user_id", "due_on", "completed"],
    )


def downgrade() -> None:
    op.drop_index("ix_reminders_user_due", table_name="reminders")
    op.drop_table("reminders")
    op.drop_index("ix_budgets_user_month", table_name="budgets")
    op.drop_table("budgets")
    op.drop_table("login_attempts")
    op.drop_index("ix_password_reset_email_active", table_name="password_reset_challenges")
    op.drop_table("password_reset_challenges")
