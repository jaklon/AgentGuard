from decimal import Decimal

from app.schemas.guard import PaymentIntent
from app.services.intent_extractor import IntentExtractor


class MockIntentExtractor(IntentExtractor):
    """
    Implementasi sementara untuk simulasi AI Intent Extraction.
    Tidak melakukan pemanggilan API eksternal.
    """

    def extract(self, instruction: str) -> PaymentIntent:
        return PaymentIntent(
            action="payment",
            recipient="0x0000000000000000000000000000000000000001",
            amount_bot=Decimal("0.01"),
            network="BOT Chain",
            purpose=instruction,
        )