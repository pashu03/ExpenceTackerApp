from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator


class UserPreferencesRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    currency_code: str
    timezone: str
    ai_insights_enabled: bool
    journal_ai_enabled: bool
    notifications_enabled: bool
    theme: str
    financial_month_start: int


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str
    profile_image_url: str | None
    created_at: datetime
    preferences: UserPreferencesRead


class UserResponse(BaseModel):
    data: UserRead


class AccountExportResponse(BaseModel):
    data: dict[str, Any]


class SettingsUpdateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    currency_code: str = Field(min_length=3, max_length=3)
    timezone: str = Field(min_length=1, max_length=100)
    financial_month_start: int = Field(ge=1, le=28)
    notifications_enabled: bool
    ai_insights_enabled: bool
    journal_ai_enabled: bool
    theme: str = Field(pattern="^(light|dark|system)$")

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if len(value) < 2:
            raise ValueError("Name must contain at least two characters")
        return value

    @field_validator("currency_code")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        value = value.upper()
        if not value.isalpha() or not value.isascii():
            raise ValueError("Currency must be a three-letter ISO code")
        return value

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("Timezone must be a valid IANA timezone") from exc
        return value
