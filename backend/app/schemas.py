from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Annotated

from agentguard_guard import PaymentIntent
from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator, model_validator

Address = Annotated[str, Field(pattern=r"^0x[a-fA-F0-9]{40}$")]
TransactionHash = Annotated[str, Field(pattern=r"^0x[a-fA-F0-9]{64}$")]


class GuardEvaluateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    prompt: str | None = Field(default=None, min_length=1, max_length=2_000)
    manual_intent: PaymentIntent | None = None
    wallet: Address

    @model_validator(mode="after")
    def require_one_input(self) -> "GuardEvaluateRequest":
        if (self.prompt is None) == (self.manual_intent is None):
            raise ValueError("provide exactly one of prompt or manual_intent")
        return self


class SimulateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    wallet: Address
    recipient: Address
    amount_bot: Decimal = Field(gt=0, max_digits=36, decimal_places=18)
    intent_hash: str = Field(pattern=r"^0x[a-fA-F0-9]{64}$")

    @field_validator("amount_bot", mode="before")
    @classmethod
    def require_decimal_string(cls, value: object) -> Decimal:
        if isinstance(value, float) or not isinstance(value, (str, int, Decimal)):
            raise ValueError("amount_bot must be a decimal string")
        try:
            parsed = Decimal(str(value))
        except InvalidOperation as exc:
            raise ValueError("invalid decimal amount") from exc
        if not parsed.is_finite():
            raise ValueError("amount must be finite")
        return parsed

    @field_serializer("amount_bot")
    def serialize_amount(self, value: Decimal) -> str:
        return format(value, "f")

    @field_validator("intent_hash")
    @classmethod
    def reject_zero_intent_hash(cls, value: str) -> str:
        if int(value, 16) == 0:
            raise ValueError("intent_hash must not be zero")
        return value.lower()


class SimulateResponse(BaseModel):
    allowed: bool
    reason: str
    estimated_gas: int | None = None


class TransactionStatus(BaseModel):
    transaction_hash: TransactionHash
    status: str
    block_number: int | None = None
    explorer_url: str


class ComponentHealth(BaseModel):
    status: str
    detail: str | None = None


class HealthResponse(BaseModel):
    status: str
    app_env: str
    database: ComponentHealth
    ai_provider: ComponentHealth
    botchain_rpc: ComponentHealth


class PublicConfigResponse(BaseModel):
    """Client-safe values shared by the frontend and API."""

    chain_id: int
    chain_name: str
    rpc_url: str
    explorer_url: str
    contract_address: Address
    allocation_wallet: Address
