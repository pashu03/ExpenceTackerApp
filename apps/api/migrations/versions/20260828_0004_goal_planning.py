"""Add monthly contributions to financial goals.

Revision ID: 20260828_0004
Revises: 20260828_0003
Create Date: 2026-08-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260828_0004"
down_revision: str | None = "20260828_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("financial_goals") as batch_op:
        batch_op.add_column(
            sa.Column(
                "monthly_contribution",
                sa.Numeric(14, 2),
                server_default=sa.text("0"),
                nullable=False,
            )
        )
        batch_op.create_check_constraint(
            "ck_goals_nonnegative_monthly_contribution",
            "monthly_contribution >= 0",
        )


def downgrade() -> None:
    with op.batch_alter_table("financial_goals") as batch_op:
        batch_op.drop_constraint(
            "ck_goals_nonnegative_monthly_contribution", type_="check"
        )
        batch_op.drop_column("monthly_contribution")
