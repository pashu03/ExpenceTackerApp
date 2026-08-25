from __future__ import annotations

from fastapi import APIRouter

from lifetracker.features.auth.dependencies import CurrentUser, SessionDependency
from lifetracker.features.users.schemas import SettingsUpdateRequest, UserRead, UserResponse
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
