from __future__ import annotations

from fastapi import APIRouter, Request, Response, status

from lifetracker.features.auth.dependencies import (
    CurrentUser,
    SessionDependency,
    SettingsDependency,
)
from lifetracker.features.auth.schemas import (
    AuthResponse,
    LoginRequest,
    MessageData,
    MessageResponse,
    RegisterRequest,
)
from lifetracker.features.auth.security import SessionTokens
from lifetracker.features.auth.service import AuthService
from lifetracker.features.users.schemas import UserRead, UserResponse

router = APIRouter(prefix="/auth", tags=["authentication"])


def _request_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _set_auth_cookies(
    response: Response, tokens: SessionTokens, settings: SettingsDependency
) -> None:
    response.set_cookie(
        settings.access_cookie_name,
        tokens.access_token,
        httponly=True,
        max_age=settings.access_token_minutes * 60,
        path="/",
        secure=settings.cookie_secure,
        samesite="lax",
    )
    response.set_cookie(
        settings.refresh_cookie_name,
        tokens.refresh_token,
        httponly=True,
        max_age=settings.refresh_token_days * 24 * 60 * 60,
        path="/api/v1/auth",
        secure=settings.cookie_secure,
        samesite="lax",
    )
    response.set_cookie(
        settings.csrf_cookie_name,
        tokens.csrf_token,
        httponly=False,
        max_age=settings.refresh_token_days * 24 * 60 * 60,
        path="/",
        secure=settings.cookie_secure,
        samesite="lax",
    )


def _clear_auth_cookies(response: Response, settings: SettingsDependency) -> None:
    response.delete_cookie(settings.access_cookie_name, path="/")
    response.delete_cookie(settings.refresh_cookie_name, path="/api/v1/auth")
    response.delete_cookie(settings.csrf_cookie_name, path="/")


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    session: SessionDependency,
    settings: SettingsDependency,
) -> AuthResponse:
    user, tokens = await AuthService(session, settings).register(
        payload,
        user_agent=request.headers.get("user-agent"),
        ip_address=_request_ip(request),
    )
    _set_auth_cookies(response, tokens, settings)
    return AuthResponse(data=UserRead.model_validate(user))


@router.post("/login", response_model=AuthResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    session: SessionDependency,
    settings: SettingsDependency,
) -> AuthResponse:
    user, tokens = await AuthService(session, settings).login(
        payload,
        user_agent=request.headers.get("user-agent"),
        ip_address=_request_ip(request),
    )
    _set_auth_cookies(response, tokens, settings)
    return AuthResponse(data=UserRead.model_validate(user))


@router.post("/refresh", response_model=AuthResponse)
async def refresh(
    request: Request,
    response: Response,
    session: SessionDependency,
    settings: SettingsDependency,
) -> AuthResponse:
    user, tokens = await AuthService(session, settings).refresh(
        request.cookies.get(settings.refresh_cookie_name)
    )
    _set_auth_cookies(response, tokens, settings)
    return AuthResponse(data=UserRead.model_validate(user))


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    response: Response,
    session: SessionDependency,
    settings: SettingsDependency,
) -> MessageResponse:
    await AuthService(session, settings).logout(request.cookies.get(settings.refresh_cookie_name))
    _clear_auth_cookies(response, settings)
    return MessageResponse(data=MessageData(message="Signed out successfully."))


@router.get("/me", response_model=UserResponse)
async def me(current_user: CurrentUser) -> UserResponse:
    return UserResponse(data=UserRead.model_validate(current_user))
