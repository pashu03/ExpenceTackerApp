from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime, timedelta

import structlog
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from lifetracker.core.config import Settings
from lifetracker.core.errors import AppError
from lifetracker.features.auth.email import send_password_reset_code
from lifetracker.features.auth.models import AuthSession, LoginAttempt, PasswordResetChallenge
from lifetracker.features.auth.repository import AuthRepository
from lifetracker.features.auth.schemas import (
    ChangePasswordRequest,
    DeleteAccountRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
)
from lifetracker.features.auth.security import (
    SessionTokens,
    create_access_token,
    hash_optional_metadata,
    hash_password,
    hash_password_reset_code,
    hash_token,
    new_csrf_token,
    new_password_reset_code,
    new_refresh_token,
    verify_password,
)
from lifetracker.features.users.models import User, UserPreference

logger = structlog.get_logger(__name__)


def utc_datetime(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value


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
        email = request.email.lower().strip()
        limit_key, attempt, rate_limit_available = await self._login_limit(email, ip_address)
        user = await self.repository.get_user_by_email(email)
        valid_password = verify_password(request.password, user.password_hash if user else None)
        if not user or not valid_password or user.status != "active":
            now = datetime.now(UTC)
            if rate_limit_available and attempt is None:
                attempt = LoginAttempt(
                    key_hash=limit_key,
                    failure_count=0,
                    window_started_at=now,
                )
                self.repository.add(attempt)
            if rate_limit_available and attempt is not None:
                attempt.failure_count += 1
                if attempt.failure_count >= self.settings.login_max_attempts:
                    attempt.blocked_until = now + timedelta(
                        minutes=self.settings.login_lock_minutes
                    )
                await self.session.commit()
            raise AppError(
                status_code=401,
                code="INVALID_CREDENTIALS",
                title="Unable to sign in",
                detail="The email or password is incorrect.",
            )

        if attempt is not None:
            await self.repository.delete(attempt)

        tokens = await self._create_session(user=user, user_agent=user_agent, ip_address=ip_address)
        await self.session.commit()
        return user, tokens

    async def request_password_reset(
        self, email_value: str, *, ip_address: str | None
    ) -> str | None:
        if self.settings.environment == "production" and not self.settings.smtp_configured:
            raise AppError(
                status_code=503,
                code="PASSWORD_RESET_UNAVAILABLE",
                title="Password reset is unavailable",
                detail="Email delivery is not configured. Please try again later.",
            )

        email = email_value.lower().strip()
        user = await self.repository.get_user_by_email(email)
        if not user or user.status != "active":
            return None

        now = datetime.now(UTC)
        recent = await self.repository.recent_password_reset_count(email, now - timedelta(hours=1))
        if recent >= 3:
            return None

        challenge_id = uuid.uuid4()
        code = new_password_reset_code()
        challenge = PasswordResetChallenge(
            id=challenge_id,
            user_id=user.id,
            email=email,
            code_hash=hash_password_reset_code(code, challenge_id, self.settings.jwt_secret),
            expires_at=now + timedelta(minutes=self.settings.password_reset_minutes),
            attempts=0,
            requester_hash=hash_optional_metadata(ip_address),
        )
        self.repository.add(challenge)

        if self.settings.environment == "production":
            try:
                await send_password_reset_code(self.settings, email, code)
            except Exception as exc:
                await self.session.rollback()
                logger.exception("password_reset_email_failed", exception_type=type(exc).__name__)
                raise AppError(
                    status_code=503,
                    code="PASSWORD_RESET_UNAVAILABLE",
                    title="Password reset is unavailable",
                    detail="The verification email could not be sent. Please try again later.",
                ) from exc

        await self.session.commit()
        return code if self.settings.environment != "production" else None

    async def reset_password(self, request: ResetPasswordRequest) -> None:
        email = request.email.lower().strip()
        now = datetime.now(UTC)
        challenge = await self.repository.get_active_password_reset(email, now)
        if challenge is None or challenge.attempts >= self.settings.password_reset_max_attempts:
            raise self._invalid_reset_error()

        expected = hash_password_reset_code(request.code, challenge.id, self.settings.jwt_secret)
        if not secrets.compare_digest(expected, challenge.code_hash):
            challenge.attempts += 1
            if challenge.attempts >= self.settings.password_reset_max_attempts:
                challenge.consumed_at = now
            await self.session.commit()
            raise self._invalid_reset_error()

        user = await self.repository.get_user_by_id(challenge.user_id)
        if not user or user.status != "active":
            challenge.consumed_at = now
            await self.session.commit()
            raise self._invalid_reset_error()
        if verify_password(request.new_password, user.password_hash):
            raise AppError(
                status_code=422,
                code="PASSWORD_REUSED",
                title="Choose a different password",
                detail="Your new password must be different from your current password.",
            )

        user.password_hash = hash_password(request.new_password)
        await self.repository.consume_password_resets(user.id)
        await self.repository.revoke_all_sessions(user.id, "password_reset")
        await self.session.commit()

    async def change_password(self, user: User, request: ChangePasswordRequest) -> None:
        if not verify_password(request.current_password, user.password_hash):
            raise AppError(
                status_code=400,
                code="CURRENT_PASSWORD_INVALID",
                title="Password was not changed",
                detail="The current password is incorrect.",
            )
        user.password_hash = hash_password(request.new_password)
        await self.repository.revoke_all_sessions(user.id, "password_changed")
        await self.session.commit()

    async def delete_account(self, user: User, request: DeleteAccountRequest) -> None:
        if not verify_password(request.password, user.password_hash):
            raise AppError(
                status_code=400,
                code="CURRENT_PASSWORD_INVALID",
                title="Account was not deleted",
                detail="The password is incorrect.",
            )
        await self.repository.delete(user)
        await self.session.commit()

    async def _login_limit(
        self, email: str, ip_address: str | None
    ) -> tuple[str, LoginAttempt | None, bool]:
        key = hash_token(f"{email}|{ip_address or 'unknown'}")
        try:
            attempt = await self.repository.get_login_attempt_for_update(key)
        except ProgrammingError as exc:
            if getattr(exc.orig, "sqlstate", None) != "42P01":
                raise
            await self.session.rollback()
            logger.warning(
                "login_rate_limit_storage_unavailable",
                exception_type=type(exc.orig).__name__,
            )
            return key, None, False
        if attempt is None:
            return key, None, True
        now = datetime.now(UTC)
        if attempt.blocked_until and utc_datetime(attempt.blocked_until) > now:
            raise AppError(
                status_code=429,
                code="LOGIN_RATE_LIMITED",
                title="Too many sign-in attempts",
                detail="Wait a few minutes before trying again.",
            )
        window_started = utc_datetime(attempt.window_started_at)
        if window_started <= now - timedelta(minutes=self.settings.login_lock_minutes):
            attempt.failure_count = 0
            attempt.window_started_at = now
            attempt.blocked_until = None
        return key, attempt, True

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

    @staticmethod
    def _invalid_reset_error() -> AppError:
        return AppError(
            status_code=400,
            code="RESET_CODE_INVALID",
            title="Password could not be reset",
            detail="The verification code is invalid or has expired.",
        )
