from abc import ABC, abstractmethod
from decimal import Decimal


class BotChainAdapter(ABC):
    @abstractmethod
    def get_policy(self, wallet: str) -> dict:
        raise NotImplementedError

    @abstractmethod
    def simulate_payment(
        self,
        wallet: str,
        recipient: str,
        amount_bot: Decimal,
    ) -> dict:
        raise NotImplementedError

    @abstractmethod
    def get_transaction(self, transaction_hash: str) -> dict:
        raise NotImplementedError