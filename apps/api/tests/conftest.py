from __future__ import annotations

import os
from collections.abc import AsyncIterator

os.environ.setdefault(
    "JWT_SECRET", "test-bootstrap-secret-that-is-longer-than-thirty-two-characters"
)

import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool  # noqa: E402

from lifetracker.core.config import Settings, get_settings  # noqa: E402
from lifetracker.db.base import Base  # noqa: E402
from lifetracker.db.session import get_session  # noqa: E402
from lifetracker.main import create_app  # noqa: E402


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    settings = Settings(
        environment="test",
        database_url="sqlite+aiosqlite://",
        jwt_secret="test-secret-that-is-longer-than-thirty-two-characters",
        cors_origins=["http://testserver"],
    )
    engine = create_async_engine(
        settings.database_url,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    async def override_session() -> AsyncIterator[AsyncSession]:
        async with session_factory() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise

    app = create_app(settings)
    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_settings] = lambda: settings

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as test_client:
        yield test_client

    await engine.dispose()
