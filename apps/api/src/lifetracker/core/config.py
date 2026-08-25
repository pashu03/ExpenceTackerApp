from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
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

    jwt_secret: str = Field(min_length=32)
    jwt_issuer: str = "lifetracker-api"
    jwt_audience: str = "lifetracker-web"
    access_token_minutes: int = Field(default=30, ge=5, le=120)
    refresh_token_days: int = Field(default=7, ge=1, le=30)
    cookie_secure: bool = False
    cors_origins: list[str] = ["http://localhost:3000"]

    access_cookie_name: str = "lifetracker_access"
    refresh_cookie_name: str = "lifetracker_refresh"
    csrf_cookie_name: str = "lifetracker_csrf"

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
