from __future__ import annotations

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from jwt import InvalidTokenError
from pwdlib import PasswordHash

from lifetracker.core.config import Settings
from lifetracker.core.errors import AppError

password_hasher = PasswordHash.recommended()
DUMMY_PASSWORD_HASH = password_hasher.hash("dummy-password-value-12345")


@dataclass(frozen=True)
class SessionTokens:
    access_token: str
    refresh_token: str
    csrf_token: str


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    return password_hasher.verify(password, password_hash or DUMMY_PASSWORD_HASH)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_optional_metadata(value: str | None) -> str | None:
    if not value:
        return None
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def new_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def new_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def create_access_token(*, user_id: uuid.UUID, session_id: uuid.UUID, settings: Settings) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "sid": str(session_id),
        "type": "access",
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_access_token(token: str, settings: Settings) -> tuple[uuid.UUID, uuid.UUID]:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            issuer=settings.jwt_issuer,
            audience=settings.jwt_audience,
            options={"require": ["sub", "sid", "type", "exp", "iat"]},
        )
        if payload.get("type") != "access":
            raise InvalidTokenError("Unexpected token type")
        return uuid.UUID(payload["sub"]), uuid.UUID(payload["sid"])
    except (InvalidTokenError, ValueError, TypeError) as exc:
        raise AppError(
            status_code=401,
            code="INVALID_SESSION",
            title="Authentication required",
            detail="Your session is invalid or has expired.",
        ) from exc
