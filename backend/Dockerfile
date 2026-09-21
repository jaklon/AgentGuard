FROM python:3.12.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY guard-engine /tmp/guard-engine
COPY backend /tmp/backend
RUN pip install --no-cache-dir /tmp/guard-engine /tmp/backend \
    && adduser --disabled-password --gecos "" --uid 10001 agentguard \
    && mkdir -p /data \
    && chown agentguard:agentguard /data
COPY backend/alembic.ini /app/alembic.ini
COPY backend/alembic /app/alembic

USER agentguard
EXPOSE 8000

CMD ["sh", "-c", "alembic -c /app/alembic.ini upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --proxy-headers --forwarded-allow-ips='*'"]
