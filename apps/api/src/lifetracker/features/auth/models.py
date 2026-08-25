from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from lifetracker.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from lifetracker.features.users.models import User


class AuthSession(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "auth_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    refresh_token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    user_agent_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ip_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    revoke_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped[User] = relationship(back_populates="sessions", lazy="selectin")

    __table_args__ = (Index("ix_auth_sessions_user_active", "user_id", "revoked_at", "expires_at"),)
