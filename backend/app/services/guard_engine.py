import re
from decimal import Decimal

from app.schemas.guard import PaymentIntent


MAX_PAYMENT_AMOUNT = Decimal("0.02")


def is_valid_recipient(recipient: str) -> bool:
    """
    Memeriksa apakah recipient memiliki format alamat Ethereum.
    """
    return bool(re.fullmatch(r"0x[a-fA-F0-9]{40}", recipient))


def evaluate_intent(intent: PaymentIntent) -> tuple[str, int, str]:
    """
    Mengevaluasi PaymentIntent secara deterministic.

    Return:
        decision, risk_score, reason
    """

    # 1. Action Check
    if intent.action.lower() != "payment":
        return (
            "BLOCK",
            100,
            "Action is not allowed",
        )

    # 2. Recipient Check
    if not is_valid_recipient(intent.recipient):
        return (
            "BLOCK",
            100,
            "Recipient address format is invalid",
        )

    # 3. Network Check
    if intent.network.lower() != "bot chain":
        return (
            "BLOCK",
            100,
            "Network is not supported",
        )

    # 4. Amount Check
    if intent.amount_bot <= 0:
        return (
            "BLOCK",
            100,
            "Payment amount must be greater than zero",
        )

    # 5. Payment Limit Check
    if intent.amount_bot > MAX_PAYMENT_AMOUNT:
        return (
            "BLOCK",
            95,
            "Payment exceeds the configured transaction limit",
        )

    # All checks passed
    return (
        "ALLOW",
        10,
        "Payment passed deterministic safety checks",
    )