from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import cast

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from lifetracker.features.auth.models import AuthSession
from lifetracker.features.users.models import User


class AuthRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_user_by_email(self, email: str) -> User | None:
        statement = select(User).where(User.email == email).options(selectinload(User.preferences))
        return cast(User | None, await self.session.scalar(statement))

    async def get_user_by_id(self, user_id: uuid.UUID) -> User | None:
        statement = select(User).where(User.id == user_id).options(selectinload(User.preferences))
        return cast(User | None, await self.session.scalar(statement))

    async def get_active_session(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> AuthSession | None:
        now = datetime.now(UTC)
        statement = select(AuthSession).where(
            AuthSession.id == session_id,
            AuthSession.user_id == user_id,
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > now,
        )
        return cast(AuthSession | None, await self.session.scalar(statement))

    async def get_session_by_refresh_hash_for_update(self, refresh_hash: str) -> AuthSession | None:
        statement = (
            select(AuthSession)
            .where(AuthSession.refresh_token_hash == refresh_hash)
            .options(selectinload(AuthSession.user).selectinload(User.preferences))
            .with_for_update()
        )
        return cast(AuthSession | None, await self.session.scalar(statement))

    def add(self, instance: object) -> None:
        self.session.add(instance)
