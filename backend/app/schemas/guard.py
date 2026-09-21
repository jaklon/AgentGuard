from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

class PaymentIntent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: str
    recipient: str
    amount_bot: Decimal = Field(gt=0)
    network: str
    purpose: str

class GuardEvaluateResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: Literal["ALLOW","WARN","BLOCK"]
    risk_score:int = Field(ge=0, le=100)
    reason: str
    intent: PaymentIntent
    transaction_hash: str | None = None

class GuardEvaluateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    instruction: str =Field(min_length=1, max_length=2000)