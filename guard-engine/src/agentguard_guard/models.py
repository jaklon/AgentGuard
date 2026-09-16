from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

Address = Annotated[str, Field(pattern=r"^0x[a-fA-F0-9]{40}$")]


def _decimal_string(value: object) -> Decimal:
    if isinstance(value, float):
        raise ValueError("amounts must be decimal strings, never floating-point values")
    if not isinstance(value, (str, int, Decimal)):
        raise ValueError("amount must be supplied as a decimal string")
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError("invalid decimal amount") from exc
    if not parsed.is_finite():
        raise ValueError("amount must be finite")
    return parsed


class Decision(StrEnum):
    ALLOW = "ALLOW"
    WARN = "WARN"
    BLOCK = "BLOCK"


class PaymentIntent(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    action: Literal["payment"] = "payment"
    recipient: Address
    amount_bot: Decimal = Field(gt=0, max_digits=36, decimal_places=18)
    chain_id: int = Field(gt=0)
    purpose: str = Field(default="", max_length=160)

    @field_validator("amount_bot", mode="before")
    @classmethod
    def validate_amount(cls, value: object) -> Decimal:
        return _decimal_string(value)

    @field_serializer("amount_bot")
    def serialize_amount(self, value: Decimal) -> str:
        return format(value, "f")


class PolicySnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    wallet: Address
    chain_id: int = Field(gt=0)
    per_transaction_limit_bot: Decimal = Field(gt=0)
    daily_limit_bot: Decimal = Field(gt=0)
    spent_today_bot: Decimal = Field(default=Decimal("0"), ge=0)
    expires_at: datetime | None = None
    allowlist_enforced: bool = False
    allowed_recipients: list[Address] = Field(default_factory=list, max_length=100)
    paused: bool = False

    @field_validator(
        "per_transaction_limit_bot",
        "daily_limit_bot",
        "spent_today_bot",
        mode="before",
    )
    @classmethod
    def validate_amounts(cls, value: object) -> Decimal:
        return _decimal_string(value)

    @field_validator("expires_at")
    @classmethod
    def normalize_expiry(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value

    @field_serializer(
        "per_transaction_limit_bot",
        "daily_limit_bot",
        "spent_today_bot",
    )
    def serialize_amounts(self, value: Decimal) -> str:
        return format(value, "f")


class GuardDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: Decision
    risk_score: int = Field(ge=0, le=100)
    reason: str = Field(min_length=1, max_length=280)
    intent: PaymentIntent | None
    warnings: list[str] = Field(default_factory=list, max_length=10)
    source: Literal["openai", "deterministic", "manual"]
    transaction_hash: None = None
    evaluated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
