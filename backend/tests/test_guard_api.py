from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_guard_evaluate_api():
    response = client.post(
        "/api/guard/evaluate",
        json={
            "instruction": "Bayar 0.01 BOT untuk biaya server",
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["decision"] == "ALLOW"
    assert data["risk_score"] == 10
    assert data["intent"]["action"] == "payment"
    assert data["intent"]["amount_bot"] == "0.01"
    assert data["intent"]["network"] == "BOT Chain"
    assert data["transaction_hash"] is None


def test_guard_evaluate_rejects_empty_instruction():
    response = client.post(
        "/api/guard/evaluate",
        json={
            "instruction": "",
        },
    )

    assert response.status_code == 422