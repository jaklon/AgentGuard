from __future__ import annotations

import time
from collections import defaultdict, deque
from uuid import uuid4

from .config import settings
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get("x-request-id") or str(uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["x-request-id"] = request_id
        response.headers["x-content-type-options"] = "nosniff"
        response.headers["referrer-policy"] = "no-referrer"
        return response


class RequestLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, *, max_bytes: int) -> None:  # type: ignore[no-untyped-def]
        super().__init__(app)
        self._max_bytes = max_bytes

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        content_length = request.headers.get("content-length")
        try:
            request_bytes = int(content_length) if content_length else 0
        except ValueError:
            return JSONResponse(
                {"detail": {"code": "INVALID_CONTENT_LENGTH", "message": "Invalid Content-Length header"}},
                status_code=400,
            )
        if request_bytes < 0:
            return JSONResponse(
                {"detail": {"code": "INVALID_CONTENT_LENGTH", "message": "Invalid Content-Length header"}},
                status_code=400,
            )
        if request_bytes > self._max_bytes:
            return JSONResponse(
                {"detail": {"code": "REQUEST_TOO_LARGE", "message": "Request body is too large"}},
                status_code=413,
            )
        return await call_next(request)


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, *, requests_per_minute: int) -> None:  # type: ignore[no-untyped-def]
        super().__init__(app)
        self._limit = requests_per_minute
        self._settings_version = settings.rate_limit_config_version
        self._buckets: dict[str, deque[float]] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.url.path == "/api/health":
            return await call_next(request)

        # Tests and local deployments may update the shared settings object after
        # the application is created.  Pick up that value for every request.
        if self._settings_version != settings.rate_limit_config_version:
            self._buckets.clear()
            self._settings_version = settings.rate_limit_config_version
        limit = settings.rate_limit_requests

        client = request.client.host if request.client else "unknown"
        now = time.monotonic()
        bucket = self._buckets[client]
        while bucket and bucket[0] <= now - 60:
            bucket.popleft()
        if len(bucket) >= limit:
            return JSONResponse(
                {"detail": "Rate limit exceeded. Please try again later."},
                status_code=429,
                headers={"retry-after": str(settings.rate_limit_window_seconds)},
            )
        bucket.append(now)
        return await call_next(request)
