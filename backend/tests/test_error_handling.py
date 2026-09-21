from fastapi import APIRouter

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_validation_error_does_not_expose_internal_details():
    response = client.post(
        "/api/guard/evaluate",
        json={
            "unexpected_field": "malicious",
        },
    )

    assert response.status_code == 422
    assert response.json() == {
        "detail": "Request validation failed",
    }


def test_request_id_header_is_present():
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.headers.get("X-Request-ID")