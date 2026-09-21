from app.schemas.guard import PaymentIntent
from app.services.guard_engine import evaluate_intent


VALID_RECIPIENT = "0x0000000000000000000000000000000000000001"


def make_intent(
    amount: str = "0.01",
    recipient: str = VALID_RECIPIENT,
    network: str = "BOT Chain",
    action: str = "payment",
) -> PaymentIntent:
    return PaymentIntent(
        action=action,
        recipient=recipient,
        amount_bot=amount,
        network=network,
        purpose="test payment",
    )


def test_valid_payment_is_allowed():
    intent = make_intent()

    decision, risk_score, reason = evaluate_intent(intent)

    assert decision == "ALLOW"
    assert risk_score == 10
    assert reason == "Payment passed deterministic safety checks"


def test_payment_above_limit_is_blocked():
    intent = make_intent(amount="0.05")

    decision, risk_score, reason = evaluate_intent(intent)

    assert decision == "BLOCK"
    assert risk_score == 95
    assert reason == "Payment exceeds the configured transaction limit"


def test_invalid_recipient_is_blocked():
    intent = make_intent(recipient="invalid-address")

    decision, risk_score, reason = evaluate_intent(intent)

    assert decision == "BLOCK"
    assert risk_score == 100
    assert reason == "Recipient address format is invalid"


def test_wrong_network_is_blocked():
    intent = make_intent(network="Ethereum")

    decision, risk_score, reason = evaluate_intent(intent)

    assert decision == "BLOCK"
    assert risk_score == 100
    assert reason == "Network is not supported"


def test_unsupported_action_is_blocked():
    intent = make_intent(action="withdraw")

    decision, risk_score, reason = evaluate_intent(intent)

    assert decision == "BLOCK"
    assert risk_score == 100
    assert reason == "Action is not allowed"