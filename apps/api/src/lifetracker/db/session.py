from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from lifetracker.core.config import get_settings

settings = get_settings()

engine_kwargs: dict[str, object] = {
    "pool_pre_ping": True,
}
if not settings.database_url.startswith("sqlite"):
    if settings.database_use_null_pool:
        engine_kwargs["poolclass"] = NullPool
    else:
        engine_kwargs.update(
            pool_size=settings.database_pool_size,
            max_overflow=settings.database_max_overflow,
        )

engine = create_async_engine(settings.database_url, **engine_kwargs)
SessionFactory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionFactory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
