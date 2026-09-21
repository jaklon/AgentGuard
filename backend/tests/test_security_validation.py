from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


VALID_WALLET = "0x0000000000000000000000000000000000000002"
VALID_RECIPIENT = "0x0000000000000000000000000000000000000001"


def test_botchain_simulate_rejects_invalid_wallet():
    response = client.post(
        "/api/botchain/simulate",
        json={
            "wallet": "invalid-wallet",
            "recipient": VALID_RECIPIENT,
            "amount_bot": "0.01",
        },
    )

    assert response.status_code == 422


def test_botchain_simulate_rejects_invalid_recipient():
    response = client.post(
        "/api/botchain/simulate",
        json={
            "wallet": VALID_WALLET,
            "recipient": "0x123",
            "amount_bot": "0.01",
        },
    )

    assert response.status_code == 422


def test_botchain_simulate_accepts_valid_addresses():
    response = client.post(
        "/api/botchain/simulate",
        json={
            "wallet": VALID_WALLET,
            "recipient": VALID_RECIPIENT,
            "amount_bot": "0.01",
        },
    )

    assert response.status_code == 200


def test_transaction_lookup_rejects_invalid_hash():
    response = client.get("/api/botchain/transaction/invalid-hash")

    assert response.status_code == 422


def test_transaction_lookup_accepts_valid_hash():
    transaction_hash = "0x" + "a" * 64

    response = client.get(
        f"/api/botchain/transaction/{transaction_hash}"
    )

    assert response.status_code == 200