from fastapi.testclient import TestClient
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from agentguard_guard import PolicySnapshot
from sqlalchemy import select

from app.database import SessionLocal
from app.main import app, ai_assistant, rpc, settings
from app.models import AuditRecord

WALLET = "0x1111111111111111111111111111111111111111"
RECIPIENT = "0x2222222222222222222222222222222222222222"


@pytest.fixture(autouse=True)
def mock_chain_policy(monkeypatch: pytest.MonkeyPatch) -> None:
    async def policy(wallet: str) -> PolicySnapshot:
        return PolicySnapshot(
            wallet=wallet, chain_id=677, per_transaction_limit_bot="0.02",
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
            "chain_id": 677,
            "purpose": "API test",
        },
        "wallet": WALLET,
    }


def test_public_config_uses_bot_chain_mainnet() -> None:
    with TestClient(app) as client:
        response = client.get("/api/config")
    assert response.status_code == 200
    body = response.json()
    assert body["chain_id"] == 677
    assert body["chain_name"] == "BOT Chain Mainnet"
    assert body["rpc_url"] == "https://rpc.botchain.ai"
    assert body["explorer_url"] == "https://scan.botchain.ai"
    assert body["contract_address"].lower() == "0xae49e0dfae28d43e149b09c4240cba2f378a1dd6"
    assert body["faucet_url"] == ""


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
        "prompt": "Send 0.01 BOT to Alice for mainnet demo",
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


def test_simulation_returns_balance_and_fee_preview(monkeypatch: pytest.MonkeyPatch) -> None:
    async def simulate(**_kwargs) -> int:
        return 82_000

    async def balance_wei(_wallet: str) -> int:
        return 2 * 10**18

    async def gas_price_wei() -> int:
        return 20 * 10**9

    monkeypatch.setattr(rpc, "simulate", simulate)
    monkeypatch.setattr(rpc, "balance_wei", balance_wei)
    monkeypatch.setattr(rpc, "gas_price_wei", gas_price_wei)
    monkeypatch.setattr(settings, "botchain_contract_address", "0x3333333333333333333333333333333333333333")
    payload = {
        "wallet": WALLET,
        "recipient": RECIPIENT,
        "amount_bot": "0.01",
        "intent_hash": "0x" + ("11" * 32),
    }
    with TestClient(app) as client:
        response = client.post("/api/botchain/simulate", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["allowed"] is True
    assert body["estimated_gas"] == 82_000
    assert body["estimated_fee_bot"] == "0.00164"
    assert body["balance_after_bot"] == "1.98836"


def test_simulation_blocks_insufficient_balance_after_fee(monkeypatch: pytest.MonkeyPatch) -> None:
    async def simulate(**_kwargs) -> int:
        return 82_000

    async def balance_wei(_wallet: str) -> int:
        return 10**16

    async def gas_price_wei() -> int:
        return 20 * 10**9

    monkeypatch.setattr(rpc, "simulate", simulate)
    monkeypatch.setattr(rpc, "balance_wei", balance_wei)
    monkeypatch.setattr(rpc, "gas_price_wei", gas_price_wei)
    monkeypatch.setattr(settings, "botchain_contract_address", "0x3333333333333333333333333333333333333333")
    payload = {
        "wallet": WALLET,
        "recipient": RECIPIENT,
        "amount_bot": "0.01",
        "intent_hash": "0x" + ("11" * 32),
    }
    with TestClient(app) as client:
        response = client.post("/api/botchain/simulate", json=payload)
    assert response.status_code == 200
    assert response.json()["allowed"] is False
    assert response.json()["reason"] == "Wallet balance is insufficient for the payment and estimated gas fee"


def test_history_returns_decoded_contract_events(monkeypatch: pytest.MonkeyPatch) -> None:
    tx_hash = "0x" + ("ab" * 32)

    async def payment_history(_wallet: str):
        item = {
            "transaction_hash": tx_hash,
            "block_number": 42,
            "timestamp": datetime(2026, 9, 22, tzinfo=UTC),
            "payer": WALLET,
            "recipient": RECIPIENT,
            "amount_bot": Decimal("0.01"),
            "intent_hash": "0x" + ("cd" * 32),
            "funded_from_balance": False,
        }
        return [item], Decimal("0.01"), 1, {RECIPIENT.lower(): (1, Decimal("0.01"))}

    async def wallet_history(_wallet: str):
        return {
            "available": True,
            "complete": True,
            "total_count": 1,
            "incoming_count": 0,
            "outgoing_count": 1,
            "total_received_bot": Decimal("0"),
            "total_sent_bot": Decimal("0.01"),
            "items": [{
                "activity_id": f"{tx_hash}:transaction:0",
                "transaction_hash": tx_hash,
                "block_number": 42,
                "timestamp": datetime(2026, 9, 22, tzinfo=UTC),
                "amount_bot": Decimal("0.01"),
                "from_address": WALLET,
                "to_address": RECIPIENT,
                "counterparty": RECIPIENT,
                "direction": "outgoing",
                "fee_bot": Decimal("0.00021"),
                "status": "confirmed",
                "method": "Transfer",
                "kind": "transaction",
            }],
        }

    monkeypatch.setattr(rpc, "payment_history", payment_history)
    monkeypatch.setattr(rpc, "wallet_history", wallet_history)
    with TestClient(app) as client:
        response = client.get(f"/api/botchain/history/{WALLET}")
        response_without_activity = client.get(f"/api/botchain/history/{WALLET}?include_wallet_activity=false")
    assert response.status_code == 200
    assert response.json()["total_spent_bot"] == "0.01"
    assert response.json()["total_count"] == 1
    assert response.json()["recipient_summaries"][0]["payment_count"] == 1
    assert response.json()["items"][0]["transaction_hash"] == tx_hash
    assert response.json()["wallet_activity"]["outgoing_count"] == 1
    assert response.json()["wallet_activity"]["items"][0]["direction"] == "outgoing"
    assert response_without_activity.status_code == 200
    assert response_without_activity.json()["wallet_activity"]["available"] is False
    assert response_without_activity.json()["wallet_activity"]["error"] == "Wallet-wide activity was not requested"


def test_readiness_reports_bundler_without_claiming_gasless(monkeypatch: pytest.MonkeyPatch) -> None:
    async def balance_wei(_wallet: str) -> int:
        return 10**18

    async def chain_id() -> int:
        return 677

    async def entry_points() -> list[str]:
        return [settings.botchain_entry_point]

    monkeypatch.setattr(rpc, "balance_wei", balance_wei)
    monkeypatch.setattr(rpc, "chain_id", chain_id)
    monkeypatch.setattr(rpc, "bundler_entry_points", entry_points)
    monkeypatch.setattr(settings, "botchain_bundler_url", "https://bundler.example")
    with TestClient(app) as client:
        response = client.get(f"/api/botchain/readiness/{WALLET}")
    assert response.status_code == 200
    assert response.json()["bundler_available"] is True
    assert response.json()["gasless_available"] is False


def test_assistant_uses_private_ai_with_fresh_live_context(monkeypatch: pytest.MonkeyPatch) -> None:
    assert ai_assistant is not None
    captured: dict = {}

    async def payment_history(_wallet: str, *, limit: int = 50):
        assert limit == 5
        item = {
            "transaction_hash": "0x" + ("ab" * 32),
            "block_number": 42,
            "timestamp": datetime(2026, 9, 23, tzinfo=UTC),
            "payer": WALLET,
            "recipient": RECIPIENT,
            "amount_bot": Decimal("0.01"),
            "intent_hash": "0x" + ("cd" * 32),
            "funded_from_balance": False,
        }
        return [item], Decimal("0.01"), 1, {RECIPIENT.lower(): (1, Decimal("0.01"))}

    async def balance_wei(_wallet: str) -> int:
        return 2 * 10**18

    async def chain_id() -> int:
        return 677

    async def chat(**kwargs) -> str:
        captured.update(kwargs)
        return "Your live balance is 2 BOT."

    monkeypatch.setattr(rpc, "payment_history", payment_history)
    monkeypatch.setattr(rpc, "balance_wei", balance_wei)
    monkeypatch.setattr(rpc, "chain_id", chain_id)
    monkeypatch.setattr(ai_assistant, "chat", chat)

    with TestClient(app) as client:
        response = client.post("/api/assistant/chat", json={
            "wallet": WALLET,
            "question": "What is my balance?",
            "conversation": [{"role": "assistant", "text": "Ask me anything."}],
            "recipient_aliases": [{"name": "Agent", "address": RECIPIENT}],
        })

    assert response.status_code == 200
    body = response.json()
    assert body["answer"] == "Your live balance is 2 BOT."
    assert body["model"] == "private-local-model"
    assert body["live_data"] is True
    assert captured["question"] == "What is my balance?"
    assert captured["conversation"] == [{"role": "assistant", "content": "Ask me anything."}]
    context = captured["live_context"]
    assert context["balance_bot"] == "2"
    assert context["history"]["confirmed_payment_count"] == 1
    assert context["history"]["recipient_summaries"][0]["name"] == "Agent"
    assert context["history"]["recent_payments"][0]["purpose"] is None
