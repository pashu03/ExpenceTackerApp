from __future__ import annotations

from typing import Annotated

from fastapi import Cookie, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from lifetracker.core.config import Settings, get_settings
from lifetracker.db.session import get_session
from lifetracker.features.auth.security import decode_access_token
from lifetracker.features.auth.service import AuthService
from lifetracker.features.users.models import User

SessionDependency = Annotated[AsyncSession, Depends(get_session)]
SettingsDependency = Annotated[Settings, Depends(get_settings)]


async def get_current_user(
    session: SessionDependency,
    settings: SettingsDependency,
    access_token: Annotated[str | None, Cookie(alias="lifetracker_access")] = None,
) -> User:
    if not access_token:
        raise AuthService._invalid_session_error()
    user_id, session_id = decode_access_token(access_token, settings)
    return await AuthService(session, settings).get_authenticated_user(user_id, session_id)


CurrentUser = Annotated[User, Depends(get_current_user)]
