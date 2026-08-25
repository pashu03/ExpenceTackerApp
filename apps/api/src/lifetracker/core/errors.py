from __future__ import annotations

from typing import Any

import structlog
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = structlog.get_logger(__name__)


class AppError(Exception):
    def __init__(
        self,
        *,
        status_code: int,
        code: str,
        title: str,
        detail: str,
        errors: list[dict[str, Any]] | None = None,
    ) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.code = code
        self.title = title
        self.detail = detail
        self.errors = errors or []


def problem_response(
    request: Request,
    *,
    status_code: int,
    code: str,
    title: str,
    detail: str,
    errors: list[dict[str, Any]] | None = None,
) -> JSONResponse:
    trace_id = getattr(request.state, "trace_id", None)
    body: dict[str, Any] = {
        "type": f"https://api.lifetracker.app/problems/{code.lower().replace('_', '-')}",
        "title": title,
        "status": status_code,
        "detail": detail,
        "instance": request.url.path,
        "code": code,
        "trace_id": trace_id,
    }
    if errors:
        body["errors"] = errors
    return JSONResponse(body, status_code=status_code, media_type="application/problem+json")


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        return problem_response(
            request,
            status_code=exc.status_code,
            code=exc.code,
            title=exc.title,
            detail=exc.detail,
            errors=exc.errors,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        errors = [
            {
                "field": ".".join(str(part) for part in error["loc"] if part != "body"),
                "code": error["type"].upper(),
                "message": error["msg"],
            }
            for error in exc.errors()
        ]
        return problem_response(
            request,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            code="VALIDATION_ERROR",
            title="Validation failed",
            detail="One or more fields are invalid.",
            errors=errors,
        )

    @app.exception_handler(IntegrityError)
    async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
        del exc
        return problem_response(
            request,
            status_code=status.HTTP_409_CONFLICT,
            code="RESOURCE_CONFLICT",
            title="Resource conflict",
            detail="The requested change conflicts with an existing record.",
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = "RESOURCE_NOT_FOUND" if exc.status_code == 404 else "HTTP_ERROR"
        title = "Resource not found" if exc.status_code == 404 else "Request failed"
        detail = str(exc.detail) if isinstance(exc.detail, str) else title
        return problem_response(
            request,
            status_code=exc.status_code,
            code=code,
            title=title,
            detail=detail,
        )

    @app.exception_handler(Exception)
    async def unexpected_error_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception(
            "unhandled_request_error",
            trace_id=getattr(request.state, "trace_id", None),
            path=request.url.path,
            method=request.method,
            exception_type=type(exc).__name__,
        )
        return problem_response(
            request,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="INTERNAL_SERVER_ERROR",
            title="Unexpected error",
            detail="The request could not be completed. Please try again.",
        )
