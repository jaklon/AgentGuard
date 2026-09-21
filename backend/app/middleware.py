import logging
import time
import uuid

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware


logger = logging.getLogger("agentguard.request")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        start_time = time.perf_counter()

        try:
            response = await call_next(request)

            duration_ms = (time.perf_counter() - start_time) * 1000

            logger.info(
                "%s %s | status=%s | duration_ms=%.2f | request_id=%s",
                request.method,
                request.url.path,
                response.status_code,
                duration_ms,
                request_id,
            )

            response.headers["X-Request-ID"] = request_id

            return response

        except Exception:
            duration_ms = (time.perf_counter() - start_time) * 1000

            logger.exception(
                "%s %s | status=500 | duration_ms=%.2f | request_id=%s",
                request.method,
                request.url.path,
                duration_ms,
                request_id,
            )

            raise