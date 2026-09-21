import time

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import RateLimitState


def enforce_rate_limit(
    request: Request,
    db: Session = Depends(get_db),
):
    client_host = request.client.host if request.client else "unknown"
    scope = f"{request.method}:{request.url.path}"

    current_time = int(time.time())
    window_seconds = settings.rate_limit_window_seconds
    window_start = current_time - (current_time % window_seconds)

    statement = select(RateLimitState).where(
        RateLimitState.client_key == client_host,
        RateLimitState.scope == scope,
        RateLimitState.window_start == window_start,
    )

    state = db.execute(statement).scalar_one_or_none()

    if state is None:
        state = RateLimitState(
            client_key=client_host,
            scope=scope,
            window_start=window_start,
            request_count=1,
        )
        db.add(state)
    else:
        state.request_count += 1

    db.commit()

    if state.request_count > settings.rate_limit_requests:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Please try again later.",
            headers={
                "Retry-After": str(window_seconds),
            },
        )