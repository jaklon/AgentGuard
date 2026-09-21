from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)

VALID_WALLET = "0x0000000000000000000000000000000000000002"
VALID_RECIPIENT = "0x0000000000000000000000000000000000000001"
VALID_TX_HASH = "0x" + "a" * 64


def test_health_api_contract():
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "agentguard-api",
    }
    assert response.headers.get("X-Request-ID")


def test_readiness_api_contract():
    response = client.get("/api/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "service": "agentguard-api",
        "database": "ok",
    }


def test_guard_evaluate_api_contract():
    response = client.post(
        "/api/guard/evaluate",
        json={
            "instruction": "Bayar 0.01 BOT untuk biaya server",
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["decision"] in {"ALLOW", "WARN", "BLOCK"}
    assert 0 <= data["risk_score"] <= 100
    assert isinstance(data["reason"], str)
    assert data["intent"]["action"] == "payment"
    assert data["intent"]["amount_bot"] == "0.01"
    assert data["intent"]["network"] == "BOT Chain"
    assert response.headers.get("X-Request-ID")


def test_botchain_policy_api_contract():
    response = client.get(
        f"/api/botchain/policy/{VALID_WALLET}"
    )

    assert response.status_code == 200

    data = response.json()

    assert data["wallet"] == VALID_WALLET
    assert data["per_payment_limit"] == "0.02"
    assert data["daily_limit"] == "0.10"
    assert data["allowed_recipient"] == VALID_RECIPIENT
    assert data["paused"] is False
    assert data["source"] == "mock"


def test_botchain_simulate_api_contract():
    response = client.post(
        "/api/botchain/simulate",
        json={
            "wallet": VALID_WALLET,
            "recipient": VALID_RECIPIENT,
            "amount_bot": "0.01",
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["status"] == "SIMULATED"
    assert data["success"] is True
    assert data["wallet"] == VALID_WALLET
    assert data["recipient"] == VALID_RECIPIENT
    assert data["amount_bot"] == "0.01"
    assert data["source"] == "mock"


def test_botchain_transaction_api_contract():
    response = client.get(
        f"/api/botchain/transaction/{VALID_TX_HASH}"
    )

    assert response.status_code == 200

    data = response.json()

    assert data["transaction_hash"] == VALID_TX_HASH
    assert data["status"] == "UNKNOWN"
    assert data["confirmed"] is False
    assert data["source"] == "mock"


def test_extra_fields_are_rejected():
    response = client.post(
        "/api/guard/evaluate",
        json={
            "instruction": "Bayar 0.01 BOT",
            "admin_override": True,
        },
    )

    assert response.status_code == 422
    assert response.json() == {
        "detail": "Request validation failed",
    }


def test_negative_payment_amount_is_rejected():
    response = client.post(
        "/api/botchain/simulate",
        json={
            "wallet": VALID_WALLET,
            "recipient": VALID_RECIPIENT,
            "amount_bot": "-0.01",
        },
    )

    assert response.status_code == 422


def test_cors_allows_configured_frontend_origin():
    response = client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert (
        response.headers["access-control-allow-origin"]
        == "http://localhost:5173"
    )