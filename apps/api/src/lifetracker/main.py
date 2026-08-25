from __future__ import annotations

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from lifetracker.api.v1.router import api_router
from lifetracker.core.config import Settings, get_settings
from lifetracker.core.errors import AppError, register_exception_handlers
from lifetracker.core.logging import configure_logging
from lifetracker.core.middleware import CsrfMiddleware, RequestContextMiddleware
from lifetracker.db.session import SessionFactory


def create_app(settings: Settings | None = None) -> FastAPI:
    app_settings = settings or get_settings()
    configure_logging(app_settings.log_level)

    app = FastAPI(
        title=app_settings.app_name,
        version="0.1.0",
        docs_url="/docs" if app_settings.environment != "production" else None,
        redoc_url=None,
        openapi_url="/api/v1/openapi.json" if app_settings.environment != "production" else None,
    )
    app.state.settings = app_settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=app_settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-CSRF-Token", "X-Request-ID", "Idempotency-Key"],
    )
    app.add_middleware(CsrfMiddleware, settings=app_settings)
    app.add_middleware(RequestContextMiddleware)
    register_exception_handlers(app)
    app.include_router(api_router)

    @app.get("/health", tags=["health"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health/ready", tags=["health"])
    async def readiness() -> dict[str, str]:
        try:
            async with SessionFactory() as session:
                await session.execute(text("SELECT 1"))
        except Exception as exc:
            raise AppError(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                code="DATABASE_UNAVAILABLE",
                title="Service unavailable",
                detail="The database is not ready.",
            ) from exc
        return {"status": "ready"}

    return app


app = create_app()
