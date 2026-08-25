from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from lifetracker.core.config import Settings
from lifetracker.core.errors import AppError
from lifetracker.features.auth.models import AuthSession
from lifetracker.features.auth.repository import AuthRepository
from lifetracker.features.auth.schemas import LoginRequest, RegisterRequest
from lifetracker.features.auth.security import (
    SessionTokens,
    create_access_token,
    hash_optional_metadata,
    hash_password,
    hash_token,
    new_csrf_token,
    new_refresh_token,
    verify_password,
)
from lifetracker.features.users.models import User, UserPreference


class AuthService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.session = session
        self.settings = settings
        self.repository = AuthRepository(session)

    async def register(
        self,
        request: RegisterRequest,
        *,
        user_agent: str | None,
        ip_address: str | None,
    ) -> tuple[User, SessionTokens]:
        email = request.email.lower().strip()
        if await self.repository.get_user_by_email(email):
            raise AppError(
                status_code=409,
                code="EMAIL_ALREADY_REGISTERED",
                title="Account already exists",
                detail="An account with this email already exists.",
            )

        user = User(
            name=request.name,
            email=email,
            password_hash=hash_password(request.password),
            auth_provider="local",
            status="active",
        )
        user.preferences = UserPreference(
            currency_code=request.currency_code,
            timezone=request.timezone,
        )
        self.repository.add(user)
        await self.session.flush()

        tokens = await self._create_session(user=user, user_agent=user_agent, ip_address=ip_address)
        await self.session.commit()
        return user, tokens

    async def login(
        self,
        request: LoginRequest,
        *,
        user_agent: str | None,
        ip_address: str | None,
    ) -> tuple[User, SessionTokens]:
        user = await self.repository.get_user_by_email(request.email.lower().strip())
        valid_password = verify_password(request.password, user.password_hash if user else None)
        if not user or not valid_password or user.status != "active":
            raise AppError(
                status_code=401,
                code="INVALID_CREDENTIALS",
                title="Unable to sign in",
                detail="The email or password is incorrect.",
            )

        tokens = await self._create_session(user=user, user_agent=user_agent, ip_address=ip_address)
        await self.session.commit()
        return user, tokens

    async def refresh(self, refresh_token: str | None) -> tuple[User, SessionTokens]:
        if not refresh_token:
            raise self._invalid_session_error()

        auth_session = await self.repository.get_session_by_refresh_hash_for_update(
            hash_token(refresh_token)
        )
        now = datetime.now(UTC)
        expires_at = auth_session.expires_at if auth_session else None
        if expires_at is not None and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        if (
            not auth_session
            or auth_session.revoked_at is not None
            or expires_at is None
            or expires_at <= now
            or auth_session.user.status != "active"
        ):
            raise self._invalid_session_error()

        rotated_refresh_token = new_refresh_token()
        auth_session.refresh_token_hash = hash_token(rotated_refresh_token)
        auth_session.last_used_at = now
        tokens = SessionTokens(
            access_token=create_access_token(
                user_id=auth_session.user_id,
                session_id=auth_session.id,
                settings=self.settings,
            ),
            refresh_token=rotated_refresh_token,
            csrf_token=new_csrf_token(),
        )
        await self.session.commit()
        return auth_session.user, tokens

    async def logout(self, refresh_token: str | None) -> None:
        if refresh_token:
            auth_session = await self.repository.get_session_by_refresh_hash_for_update(
                hash_token(refresh_token)
            )
            if auth_session and auth_session.revoked_at is None:
                auth_session.revoked_at = datetime.now(UTC)
                auth_session.revoke_reason = "user_logout"
                await self.session.commit()

    async def get_authenticated_user(self, user_id: uuid.UUID, session_id: uuid.UUID) -> User:
        auth_session = await self.repository.get_active_session(session_id, user_id)
        user = await self.repository.get_user_by_id(user_id) if auth_session else None
        if not user or user.status != "active":
            raise self._invalid_session_error()
        return user

    async def _create_session(
        self, *, user: User, user_agent: str | None, ip_address: str | None
    ) -> SessionTokens:
        refresh_token = new_refresh_token()
        auth_session = AuthSession(
            user_id=user.id,
            refresh_token_hash=hash_token(refresh_token),
            expires_at=datetime.now(UTC) + timedelta(days=self.settings.refresh_token_days),
            user_agent_hash=hash_optional_metadata(user_agent),
            ip_hash=hash_optional_metadata(ip_address),
        )
        self.repository.add(auth_session)
        await self.session.flush()
        return SessionTokens(
            access_token=create_access_token(
                user_id=user.id, session_id=auth_session.id, settings=self.settings
            ),
            refresh_token=refresh_token,
            csrf_token=new_csrf_token(),
        )

    @staticmethod
    def _invalid_session_error() -> AppError:
        return AppError(
            status_code=401,
            code="INVALID_SESSION",
            title="Authentication required",
            detail="Your session is invalid or has expired.",
        )
