from __future__ import annotations

import re
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from lifetracker.features.users.schemas import UserRead


def strong_password(value: str) -> str:
    if not re.search(r"[A-Za-z]", value) or not re.search(r"\d", value):
        raise ValueError("Password must contain at least one letter and one number")
    return value


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    currency_code: str = Field(default="INR", min_length=3, max_length=3)
    timezone: str = Field(default="Asia/Kolkata", min_length=1, max_length=100)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if len(normalized) < 2:
            raise ValueError("Name must contain at least two characters")
        return normalized

    @field_validator("email", mode="before")
    @classmethod
    def validate_lowercase_email(cls, value: object) -> object:
        if isinstance(value, str) and value != value.lower():
            raise ValueError("Email address must use lowercase letters only")
        return value

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        return strong_password(value)

    @field_validator("currency_code")
    @classmethod
    def validate_currency(cls, value: str) -> str:
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


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        return strong_password(value)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        return strong_password(value)

    @model_validator(mode="after")
    def password_must_change(self) -> ChangePasswordRequest:
        if self.current_password == self.new_password:
            raise ValueError("New password must be different from the current password")
        return self


class DeleteAccountRequest(BaseModel):
    password: str = Field(min_length=1, max_length=128)
    confirmation: str

    @field_validator("confirmation")
    @classmethod
    def confirm_deletion(cls, value: str) -> str:
        if value != "DELETE":
            raise ValueError('Type "DELETE" to confirm account deletion')
        return value


class AuthResponse(BaseModel):
    data: UserRead


class MessageData(BaseModel):
    message: str
    development_code: str | None = None


class MessageResponse(BaseModel):
    data: MessageData
