from __future__ import annotations

from fastapi import APIRouter

from lifetracker.features.auth.dependencies import CurrentUser, SessionDependency
from lifetracker.features.users.schemas import (
    AccountExportResponse,
    SettingsUpdateRequest,
    UserRead,
    UserResponse,
)
from lifetracker.features.users.service import UserSettingsService

router = APIRouter(prefix="/settings", tags=["settings"])


@router.put("", response_model=UserResponse)
async def update_settings(
    payload: SettingsUpdateRequest,
    session: SessionDependency,
    current_user: CurrentUser,
) -> UserResponse:
    user = await UserSettingsService(session).update(current_user, payload)
    return UserResponse(data=UserRead.model_validate(user))


@router.get("/export", response_model=AccountExportResponse)
async def export_account_data(
    session: SessionDependency, current_user: CurrentUser
) -> AccountExportResponse:
    data = await UserSettingsService(session).export(current_user)
    return AccountExportResponse(data=data)
