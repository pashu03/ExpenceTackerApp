from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from lifetracker.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from lifetracker.features.auth.models import AuthSession


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    auth_provider: Mapped[str] = mapped_column(String(30), nullable=False, default="local")
    profile_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")

    preferences: Mapped[UserPreference] = relationship(
        back_populates="user", cascade="all, delete-orphan", lazy="selectin", uselist=False
    )
    sessions: Mapped[list[AuthSession]] = relationship(
        back_populates="user", cascade="all, delete-orphan", lazy="raise"
    )

    __table_args__ = (
        CheckConstraint("auth_provider IN ('local', 'google', 'oidc')", name="ck_users_provider"),
        CheckConstraint(
            "status IN ('active', 'disabled', 'pending_deletion')", name="ck_users_status"
        ),
        Index("ix_users_email", "email", unique=True),
    )


class UserPreference(TimestampMixin, Base):
    __tablename__ = "user_preferences"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    currency_code: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    timezone: Mapped[str] = mapped_column(String(100), nullable=False, default="Asia/Kolkata")
    ai_insights_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    journal_ai_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    theme: Mapped[str] = mapped_column(String(10), nullable=False, default="system")
    financial_month_start: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)

    user: Mapped[User] = relationship(back_populates="preferences")

    __table_args__ = (
        CheckConstraint("financial_month_start BETWEEN 1 AND 28", name="ck_financial_month_start"),
        CheckConstraint("theme IN ('light', 'dark', 'system')", name="ck_theme"),
    )
