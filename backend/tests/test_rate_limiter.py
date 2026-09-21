from fastapi.testclient import TestClient

from app.config import settings
from app.main import app


client = TestClient(app)


def test_guard_rate_limit_allows_requests_under_limit():
    original_limit = settings.rate_limit_requests
    settings.rate_limit_requests = 3

    try:
        for _ in range(3):
            response = client.post(
                "/api/guard/evaluate",
                json={
                    "instruction": "Bayar 0.01 BOT untuk biaya server",
                },
            )

            assert response.status_code == 200

    finally:
        settings.rate_limit_requests = original_limit


def test_guard_rate_limit_returns_429_when_limit_exceeded():
    original_limit = settings.rate_limit_requests
    settings.rate_limit_requests = 3

    try:
        for _ in range(3):
            response = client.post(
                "/api/guard/evaluate",
                json={
                    "instruction": "Bayar 0.01 BOT untuk biaya server",
                },
            )

            assert response.status_code == 200

        response = client.post(
            "/api/guard/evaluate",
            json={
                "instruction": "Bayar 0.01 BOT untuk biaya server",
            },
        )

        assert response.status_code == 429
        assert response.json()["detail"] == (
            "Rate limit exceeded. Please try again later."
        )
        assert response.headers["retry-after"] == str(
            settings.rate_limit_window_seconds
        )

    finally:
        settings.rate_limit_requests = original_limit