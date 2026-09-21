from fastapi import APIRouter, Path

from app.schemas.botchain import (
    BotChainPolicyResponse,
    BotChainSimulateRequest,
    BotChainSimulateResponse,
    BotChainTransactionResponse,
)
from app.services.botchain_service import BotChainService
from app.services.mock_botchain_adapter import MockBotChainAdapter


router = APIRouter(prefix="/api/botchain", tags=["BOT Chain"])


def get_botchain_service() -> BotChainService:
    return BotChainService(adapter=MockBotChainAdapter())


@router.get("/policy/{wallet}", response_model=BotChainPolicyResponse)
def get_policy(wallet: str):
    service = get_botchain_service()
    return service.get_policy(wallet)


@router.post("/simulate", response_model=BotChainSimulateResponse)
def simulate_payment(request: BotChainSimulateRequest):
    service = get_botchain_service()

    return service.simulate_payment(
        wallet=request.wallet,
        recipient=request.recipient,
        amount_bot=request.amount_bot,
    )


@router.get(
    "/transaction/{transaction_hash}",
    response_model=BotChainTransactionResponse,
)
def get_transaction(
    transaction_hash: str = Path(
        min_length=66,
        max_length=66,
        pattern=r"^0x[a-fA-F0-9]{64}$",
    ),
):
    service = get_botchain_service()
    return service.get_transaction(transaction_hash)