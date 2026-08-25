from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from lifetracker.features.users.models import User
from lifetracker.features.users.schemas import SettingsUpdateRequest


class UserSettingsService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def update(self, user: User, request: SettingsUpdateRequest) -> User:
        user.name = request.name
        user.preferences.currency_code = request.currency_code
        user.preferences.timezone = request.timezone
        user.preferences.financial_month_start = request.financial_month_start
        user.preferences.notifications_enabled = request.notifications_enabled
        user.preferences.ai_insights_enabled = request.ai_insights_enabled
        user.preferences.journal_ai_enabled = request.journal_ai_enabled
        user.preferences.theme = request.theme
        await self.session.commit()
        await self.session.refresh(user)
        return user
