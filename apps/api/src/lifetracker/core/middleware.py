from __future__ import annotations

import secrets
import uuid
from collections.abc import Awaitable, Callable

from fastapi import Request, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from lifetracker.core.config import Settings
from lifetracker.core.errors import problem_response


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        trace_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.trace_id = trace_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = trace_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response


class CsrfMiddleware(BaseHTTPMiddleware):
    _SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
    _EXEMPT_PATHS = {"/api/v1/auth/register", "/api/v1/auth/login"}

    def __init__(self, app: object, settings: Settings) -> None:
        super().__init__(app)  # type: ignore[arg-type]
        self.settings = settings

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if request.method in self._SAFE_METHODS or request.url.path in self._EXEMPT_PATHS:
            return await call_next(request)

        csrf_cookie = request.cookies.get(self.settings.csrf_cookie_name)
        csrf_header = request.headers.get("X-CSRF-Token")
        if (
            not csrf_cookie
            or not csrf_header
            or not secrets.compare_digest(csrf_cookie, csrf_header)
        ):
            return problem_response(
                request,
                status_code=status.HTTP_403_FORBIDDEN,
                code="CSRF_VALIDATION_FAILED",
                title="Request could not be verified",
                detail="Refresh the page and try again.",
            )
        return await call_next(request)
