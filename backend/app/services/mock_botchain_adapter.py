from decimal import Decimal

from app.services.botchain_adapter import BotChainAdapter


class MockBotChainAdapter(BotChainAdapter):
    def get_policy(self, wallet: str) -> dict:
        return {
            "wallet": wallet,
            "per_payment_limit": Decimal("0.02"),
            "daily_limit": Decimal("0.10"),
            "allowed_recipient": "0x0000000000000000000000000000000000000001",
            "expires_at": None,
            "paused": False,
            "source": "mock",
        }

    def simulate_payment(
        self,
        wallet: str,
        recipient: str,
        amount_bot: Decimal,
    ) -> dict:
        policy = self.get_policy(wallet)

        if policy["paused"]:
            return {
                "status": "BLOCKED",
                "success": False,
                "wallet": wallet,
                "recipient": recipient,
                "amount_bot": amount_bot,
                "reason": "Payment is currently paused",
                "source": "mock",
            }

        if amount_bot > policy["per_payment_limit"]:
            return {
                "status": "BLOCKED",
                "success": False,
                "wallet": wallet,
                "recipient": recipient,
                "amount_bot": amount_bot,
                "reason": "Payment exceeds the configured per-payment limit",
                "source": "mock",
            }

        if policy["allowed_recipient"] != recipient:
            return {
                "status": "BLOCKED",
                "success": False,
                "wallet": wallet,
                "recipient": recipient,
                "amount_bot": amount_bot,
                "reason": "Recipient is not allowed by policy",
                "source": "mock",
            }

        return {
            "status": "SIMULATED",
            "success": True,
            "wallet": wallet,
            "recipient": recipient,
            "amount_bot": amount_bot,
            "reason": "Payment passed mock BOT Chain policy simulation",
            "source": "mock",
        }

    def get_transaction(self, transaction_hash: str) -> dict:
        return {
            "transaction_hash": transaction_hash,
            "status": "UNKNOWN",
            "confirmed": False,
            "source": "mock",
        }