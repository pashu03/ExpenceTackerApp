from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import cast

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from lifetracker.features.auth.models import AuthSession, LoginAttempt, PasswordResetChallenge
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

    async def get_login_attempt_for_update(self, key_hash: str) -> LoginAttempt | None:
        statement = select(LoginAttempt).where(LoginAttempt.key_hash == key_hash).with_for_update()
        return cast(LoginAttempt | None, await self.session.scalar(statement))

    async def get_active_password_reset(
        self, email: str, now: datetime
    ) -> PasswordResetChallenge | None:
        statement = (
            select(PasswordResetChallenge)
            .where(
                PasswordResetChallenge.email == email,
                PasswordResetChallenge.consumed_at.is_(None),
                PasswordResetChallenge.expires_at > now,
            )
            .order_by(PasswordResetChallenge.created_at.desc())
            .with_for_update()
        )
        return cast(PasswordResetChallenge | None, await self.session.scalar(statement))

    async def recent_password_reset_count(self, email: str, since: datetime) -> int:
        statement = select(PasswordResetChallenge).where(
            PasswordResetChallenge.email == email,
            PasswordResetChallenge.created_at >= since,
        )
        return len((await self.session.scalars(statement)).all())

    async def revoke_all_sessions(self, user_id: uuid.UUID, reason: str) -> None:
        now = datetime.now(UTC)
        await self.session.execute(
            update(AuthSession)
            .where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
            .values(revoked_at=now, revoke_reason=reason)
        )

    async def consume_password_resets(self, user_id: uuid.UUID) -> None:
        await self.session.execute(
            update(PasswordResetChallenge)
            .where(
                PasswordResetChallenge.user_id == user_id,
                PasswordResetChallenge.consumed_at.is_(None),
            )
            .values(consumed_at=datetime.now(UTC))
        )

    def add(self, instance: object) -> None:
        self.session.add(instance)

    async def delete(self, instance: object) -> None:
        await self.session.delete(instance)
