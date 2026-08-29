from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local", ".env.development", "apps/api/.env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "LifeTracker API"
    environment: Literal["development", "test", "production"] = "development"
    log_level: str = "INFO"

    database_url: str = "postgresql+asyncpg://lifetracker:lifetracker@localhost:5432/lifetracker"
    database_pool_size: int = Field(default=5, ge=1, le=50)
    database_max_overflow: int = Field(default=10, ge=0, le=100)
    database_use_null_pool: bool = False

    jwt_secret: str = Field(min_length=32)
    jwt_issuer: str = "lifetracker-api"
    jwt_audience: str = "lifetracker-web"
    access_token_minutes: int = Field(default=30, ge=5, le=120)
    refresh_token_days: int = Field(default=7, ge=1, le=30)
    password_reset_minutes: int = Field(default=10, ge=5, le=30)
    password_reset_max_attempts: int = Field(default=5, ge=3, le=10)
    login_max_attempts: int = Field(default=5, ge=3, le=20)
    login_lock_minutes: int = Field(default=15, ge=1, le=60)
    cookie_secure: bool = False
    cors_origins: list[str] = ["http://localhost:3000"]

    smtp_host: str | None = None
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str | None = None
    smtp_use_tls: bool = True

    access_cookie_name: str = "lifetracker_access"
    refresh_cookie_name: str = "lifetracker_refresh"
    csrf_cookie_name: str = "lifetracker_csrf"

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_driver(cls, value: object) -> object:
        if isinstance(value, str):
            if value.startswith("postgresql://"):
                return value.replace("postgresql://", "postgresql+asyncpg://", 1)
            if value.startswith("postgres://"):
                return value.replace("postgres://", "postgresql+asyncpg://", 1)
        return value

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_from_email)

    def model_post_init(self, __context: object) -> None:
        if self.environment == "production":
            if self.jwt_secret.startswith("development-only") or self.jwt_secret.startswith(
                "replace-"
            ):
                raise ValueError("JWT_SECRET must be a unique production secret")
            if not self.cookie_secure:
                raise ValueError("COOKIE_SECURE must be true in production")


@lru_cache
def get_settings() -> Settings:
    return Settings()
