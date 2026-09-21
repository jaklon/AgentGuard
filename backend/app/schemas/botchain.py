from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.validators.blockchain import (
    is_valid_evm_address,
)


WalletAddress = Annotated[
    str,
    StringConstraints(pattern=r"^0x[a-fA-F0-9]{40}$"),
]


class BotChainPolicyResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    wallet: WalletAddress
    per_payment_limit: Decimal
    daily_limit: Decimal
    allowed_recipient: WalletAddress | None
    expires_at: str | None
    paused: bool
    source: str


class BotChainSimulateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    wallet: WalletAddress
    recipient: WalletAddress
    amount_bot: Decimal = Field(gt=0)


class BotChainSimulateResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str
    success: bool
    wallet: WalletAddress
    recipient: WalletAddress
    amount_bot: Decimal
    reason: str
    source: str


class BotChainTransactionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    transaction_hash: str
    status: str
    confirmed: bool
    source: str