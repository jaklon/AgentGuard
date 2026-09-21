from decimal import Decimal

from app.services.guard_engine import evaluate_intent
from app.services.mock_intent_extractor import MockIntentExtractor


def test_mock_extractor_returns_payment_intent():
    extractor = MockIntentExtractor()

    intent = extractor.extract("Bayar 0.01 BOT untuk biaya server")

    assert intent.action == "payment"
    assert intent.recipient == "0x0000000000000000000000000000000000000001"
    assert intent.amount_bot == Decimal("0.01")
    assert intent.network == "BOT Chain"
    assert intent.purpose == "Bayar 0.01 BOT untuk biaya server"


def test_mock_intent_passes_guard_engine():
    extractor = MockIntentExtractor()

    intent = extractor.extract("Bayar 0.01 BOT untuk biaya server")

    decision, risk_score, reason = evaluate_intent(intent)

    assert decision == "ALLOW"
    assert risk_score == 10
    assert reason == "Payment passed deterministic safety checks"