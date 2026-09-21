from decimal import Decimal

from app.services.botchain_adapter import BotChainAdapter


class BotChainService:
    def __init__(self, adapter: BotChainAdapter):
        self.adapter = adapter

    def get_policy(self, wallet: str) -> dict:
        return self.adapter.get_policy(wallet)

    def simulate_payment(
        self,
        wallet: str,
        recipient: str,
        amount_bot: Decimal,
    ) -> dict:
        return self.adapter.simulate_payment(
            wallet=wallet,
            recipient=recipient,
            amount_bot=amount_bot,
        )

    def get_transaction(self, transaction_hash: str) -> dict:
        return self.adapter.get_transaction(transaction_hash)