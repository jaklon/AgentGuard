from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


VALID_WALLET = "0x0000000000000000000000000000000000000002"
ALLOWED_RECIPIENT = "0x0000000000000000000000000000000000000001"


def test_payment_flow_allowed():
    # Step 1: Guard evaluates the payment instruction
    guard_response = client.post(
        "/api/guard/evaluate",
        json={
            "instruction": "Bayar 0.01 BOT ke recipient yang diizinkan"
        },
    )

    assert guard_response.status_code == 200

    guard_data = guard_response.json()

    assert guard_data["decision"] == "ALLOW"
    assert guard_data["risk_score"] <= 100
    assert guard_data["intent"]["amount_bot"] == "0.01"

    # Step 2: Simulate the payment through BOT Chain adapter
    simulate_response = client.post(
        "/api/botchain/simulate",
        json={
            "wallet": VALID_WALLET,
            "recipient": ALLOWED_RECIPIENT,
            "amount_bot": "0.01",
        },
    )

    assert simulate_response.status_code == 200

    simulate_data = simulate_response.json()

    assert simulate_data["status"] == "SIMULATED"
    assert simulate_data["success"] is True
    assert simulate_data["source"] == "mock"


def test_payment_flow_blocked_by_botchain_policy():
    # Step 1: Guard evaluates the instruction
    guard_response = client.post(
        "/api/guard/evaluate",
        json={
            "instruction": "Bayar 0.05 BOT ke recipient yang diizinkan"
        },
    )

    assert guard_response.status_code == 200

    guard_data = guard_response.json()

    assert guard_data["decision"] == "ALLOW"

    # Step 2: BOT Chain policy rejects the amount
    simulate_response = client.post(
        "/api/botchain/simulate",
        json={
            "wallet": VALID_WALLET,
            "recipient": ALLOWED_RECIPIENT,
            "amount_bot": "0.05",
        },
    )

    assert simulate_response.status_code == 200

    simulate_data = simulate_response.json()

    assert simulate_data["status"] == "BLOCKED"
    assert simulate_data["success"] is False
    assert "per-payment limit" in simulate_data["reason"]
    assert simulate_data["source"] == "mock"