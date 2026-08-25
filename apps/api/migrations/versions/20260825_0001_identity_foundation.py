"""Create identity foundation.

Revision ID: 20260825_0001
Revises:
Create Date: 2026-08-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260825_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=True),
        sa.Column("auth_provider", sa.String(length=30), nullable=False),
        sa.Column("profile_image_url", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
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
        sa.CheckConstraint(
            "auth_provider IN ('local', 'google', 'oidc')", name="ck_users_provider"
        ),
        sa.CheckConstraint(
            "status IN ('active', 'disabled', 'pending_deletion')", name="ck_users_status"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "user_preferences",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("currency_code", sa.String(length=3), nullable=False),
        sa.Column("timezone", sa.String(length=100), nullable=False),
        sa.Column("ai_insights_enabled", sa.Boolean(), nullable=False),
        sa.Column("journal_ai_enabled", sa.Boolean(), nullable=False),
        sa.Column("notifications_enabled", sa.Boolean(), nullable=False),
        sa.Column("theme", sa.String(length=10), nullable=False),
        sa.Column("financial_month_start", sa.SmallInteger(), nullable=False),
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
        sa.CheckConstraint(
            "financial_month_start BETWEEN 1 AND 28", name="ck_financial_month_start"
        ),
        sa.CheckConstraint("theme IN ('light', 'dark', 'system')", name="ck_theme"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )

    op.create_table(
        "auth_sessions",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("refresh_token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("user_agent_hash", sa.String(length=64), nullable=True),
        sa.Column("ip_hash", sa.String(length=64), nullable=True),
        sa.Column("revoke_reason", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("refresh_token_hash"),
    )
    op.create_index(
        "ix_auth_sessions_user_active",
        "auth_sessions",
        ["user_id", "revoked_at", "expires_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_auth_sessions_user_active", table_name="auth_sessions")
    op.drop_table("auth_sessions")
    op.drop_table("user_preferences")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
