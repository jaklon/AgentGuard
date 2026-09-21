from abc import ABC, abstractmethod

from app.schemas.guard import PaymentIntent


class IntentExtractor(ABC):
    """
    Interface untuk mengambil PaymentIntent
    dari instruksi natural-language user.
    """

    @abstractmethod
    def extract(self, instruction: str) -> PaymentIntent:
        """
        Mengubah instruksi user menjadi PaymentIntent.
        """
        raise NotImplementedError