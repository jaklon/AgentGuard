from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import SessionLocal
from app.main import app
from app.models import AuditRecord

WALLET = "0x1111111111111111111111111111111111111111"
RECIPIENT = "0x2222222222222222222222222222222222222222"


def request_payload(amount: str) -> dict:
    return {
        "manual_intent": {
            "action": "payment",
            "recipient": RECIPIENT,
            "amount_bot": amount,
            "chain_id": 968,
            "purpose": "API test",
        },
        "policy": {
            "wallet": WALLET,
            "chain_id": 968,
            "per_transaction_limit_bot": "0.02",
            "daily_limit_bot": "0.10",
            "spent_today_bot": "0",
            "expires_at": None,
            "allowlist_enforced": True,
            "allowed_recipients": [RECIPIENT],
            "paused": False,
        },
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
