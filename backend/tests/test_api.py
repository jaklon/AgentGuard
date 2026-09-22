from fastapi.testclient import TestClient

import pytest
from agentguard_guard import PolicySnapshot
from sqlalchemy import select

from app.database import SessionLocal
from app.main import app, rpc
from app.models import AuditRecord

WALLET = "0x1111111111111111111111111111111111111111"
RECIPIENT = "0x2222222222222222222222222222222222222222"


@pytest.fixture(autouse=True)
def mock_chain_policy(monkeypatch: pytest.MonkeyPatch) -> None:
    async def policy(wallet: str) -> PolicySnapshot:
        return PolicySnapshot(
            wallet=wallet, chain_id=968, per_transaction_limit_bot="0.02",
            daily_limit_bot="0.10", spent_today_bot="0", expires_at=None,
            allowlist_enforced=True, allowed_recipients=[RECIPIENT], paused=False,
        )
    monkeypatch.setattr(rpc, "policy", policy)


def request_payload(amount: str) -> dict:
    return {
        "manual_intent": {
            "action": "payment",
            "recipient": RECIPIENT,
            "amount_bot": amount,
            "chain_id": 968,
            "purpose": "API test",
        },
        "wallet": WALLET,
    }


def test_manual_evaluation_and_sanitized_audit() -> None:
    with TestClient(app) as client:
        response = client.post("/api/guard/evaluate", json=request_payload("0.01"))
    assert response.status_code == 200
    assert response.json()["decision"] == "ALLOW"

    with SessionLocal() as session:
        record = session.scalar(select(AuditRecord))
        assert record is not None
        assert record.prompt_hash is None
        assert record.amount_bot == "0.01"


def test_over_limit_is_blocked() -> None:
    with TestClient(app) as client:
        response = client.post("/api/guard/evaluate", json=request_payload("0.05"))
    assert response.status_code == 200
    assert response.json()["decision"] == "BLOCK"
    assert response.json()["risk_score"] == 92


def test_rejects_floating_point_amount() -> None:
    payload = request_payload("0.01")
    payload["manual_intent"]["amount_bot"] = 0.01
    with TestClient(app) as client:
        response = client.post("/api/guard/evaluate", json=payload)
    assert response.status_code == 422


def test_evaluates_a_saved_recipient_name_without_an_address_in_prompt() -> None:
    payload = {
        "wallet": WALLET,
        "prompt": "Send 0.01 BOT to Alice for testnet demo",
        "recipient_aliases": [{"name": "Alice", "address": RECIPIENT}],
    }
    with TestClient(app) as client:
        response = client.post("/api/guard/evaluate", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["decision"] == "ALLOW"
    assert body["intent"]["recipient"].lower() == RECIPIENT.lower()


def test_rejects_an_ambiguous_recipient_name() -> None:
    payload = {
        "wallet": WALLET,
        "prompt": "Send 0.01 BOT to Alice and Bob",
        "recipient_aliases": [
            {"name": "Alice", "address": RECIPIENT},
            {"name": "Bob", "address": "0x3333333333333333333333333333333333333333"},
        ],
    }
    with TestClient(app) as client:
        response = client.post("/api/guard/evaluate", json=payload)
    assert response.status_code == 422
    assert response.json()["detail"]["message"] == "Choose exactly one recipient"


def test_rejects_zero_simulation_intent_hash() -> None:
    payload = {"wallet": WALLET, "recipient": RECIPIENT, "amount_bot": "0.01", "intent_hash": "0x" + ("00" * 32)}
    with TestClient(app) as client:
        response = client.post("/api/botchain/simulate", json=payload)
    assert response.status_code == 422
