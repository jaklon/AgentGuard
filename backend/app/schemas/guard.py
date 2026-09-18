from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field

class PaymentIntent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: str
    recipient: str
    amount_bot: Decimal = Field(gt=0)
    network: str
    purpose: str