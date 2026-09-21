from __future__ import annotations

import hashlib
from contextlib import asynccontextmanager

from agentguard_guard import (
    GuardDecision,
    GuardService,
    IntentExtractionError,
    OpenAIIntentExtractor,
)
from fastapi import Depends, FastAPI, HTTPException, Path, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db, init_db
from .logging import configure_logging
from .middleware import RateLimitMiddleware, RequestContextMiddleware, RequestLimitMiddleware
from .models import AuditRecord
from .rpc import BotChainRpc, RpcError
from .schemas import (
    ComponentHealth,
    GuardEvaluateRequest,
    HealthResponse,
    PublicConfigResponse,
    SimulateRequest,
    SimulateResponse,
    TransactionStatus,
)

settings = get_settings()
configure_logging(settings.log_level)
rpc = BotChainRpc(settings)

primary_extractor = None
if settings.ai_provider == "openai" and settings.openai_api_key:
    primary_extractor = OpenAIIntentExtractor(
        api_key=settings.openai_api_key,
        model=settings.ai_model,
        timeout_seconds=settings.model_timeout_seconds,
    )
guard = GuardService(primary_extractor=primary_extractor)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="AgentGuard API",
    version="0.1.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["content-type", "x-request-id"],
)
app.add_middleware(RateLimitMiddleware, requests_per_minute=settings.api_rate_limit_per_minute)
app.add_middleware(RequestLimitMiddleware, max_bytes=settings.max_request_bytes)
app.add_middleware(RequestContextMiddleware)


@app.post("/api/guard/evaluate", response_model=GuardDecision)
async def evaluate_guard(
    payload: GuardEvaluateRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> GuardDecision:
    try:
        policy = await rpc.policy(payload.wallet)
    except RpcError as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "POLICY_UNAVAILABLE", "message": str(exc)},
        ) from exc
    try:
        result = await guard.evaluate(
            prompt=payload.prompt,
            policy=policy,
            manual_intent=payload.manual_intent,
        )
    except IntentExtractionError as exc:
        raise HTTPException(
            status_code=422,
            detail={"code": "INTENT_INVALID", "message": str(exc)},
        ) from exc

    prompt_hash = (
        hashlib.sha256(payload.prompt.encode("utf-8")).hexdigest() if payload.prompt else None
    )
    db.add(
        AuditRecord(
            request_id=request.state.request_id,
            wallet=payload.wallet,
            prompt_hash=prompt_hash,
            decision=result.decision.value,
            risk_score=result.risk_score,
            reason=result.reason,
            recipient=result.intent.recipient if result.intent else None,
            amount_bot=format(result.intent.amount_bot, "f") if result.intent else None,
            chain_id=result.intent.chain_id if result.intent else None,
            source=result.source,
        )
    )
    db.commit()
    return result


@app.post("/api/botchain/simulate", response_model=SimulateResponse)
async def simulate_transaction(payload: SimulateRequest) -> SimulateResponse:
    try:
        gas = await rpc.simulate(
            wallet=payload.wallet,
            recipient=payload.recipient,
            amount_bot=payload.amount_bot,
            intent_hash=payload.intent_hash,
        )
    except RpcError as exc:
        return SimulateResponse(allowed=False, reason=str(exc), estimated_gas=None)
    return SimulateResponse(
        allowed=True,
        reason="Contract simulation succeeded",
        estimated_gas=gas,
    )


@app.get("/api/config", response_model=PublicConfigResponse)
async def public_config() -> PublicConfigResponse:
    if not settings.botchain_contract_address:
        raise HTTPException(
            status_code=503,
            detail={"code": "CONTRACT_UNAVAILABLE", "message": "Contract address is not configured"},
        )
    return PublicConfigResponse(
        chain_id=settings.botchain_testnet_chain_id,
        chain_name="BOT Testnet",
        rpc_url=settings.botchain_testnet_rpc_url,
        explorer_url=settings.botchain_testnet_explorer_url,
        contract_address=settings.botchain_contract_address,
        allocation_wallet=settings.botchain_allocation_wallet,
    )


@app.get("/api/botchain/policy/{wallet}")
async def get_policy(
    wallet: str = Path(pattern=r"^0x[a-fA-F0-9]{40}$"),
):
    try:
        return await rpc.policy(wallet)
    except RpcError as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "POLICY_UNAVAILABLE", "message": str(exc)},
        ) from exc


@app.get("/api/botchain/transaction/{transaction_hash}", response_model=TransactionStatus)
async def get_transaction(
    transaction_hash: str = Path(pattern=r"^0x[a-fA-F0-9]{64}$"),
) -> TransactionStatus:
    try:
        receipt = await rpc.transaction_receipt(transaction_hash)
    except RpcError as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "RPC_UNAVAILABLE", "message": str(exc)},
        ) from exc
    if receipt is None:
        status = "pending"
        block_number = None
    else:
        status = "confirmed" if int(receipt["status"], 16) == 1 else "reverted"
        block_number = int(receipt["blockNumber"], 16)
    return TransactionStatus(
        transaction_hash=transaction_hash,
        status=status,
        block_number=block_number,
        explorer_url=f"{settings.botchain_testnet_explorer_url}/tx/{transaction_hash}",
    )


@app.get("/api/health", response_model=HealthResponse)
async def health(db: Session = Depends(get_db)) -> HealthResponse:
    try:
        db.execute(text("SELECT 1"))
        database = ComponentHealth(status="ok")
    except Exception:
        database = ComponentHealth(status="error", detail="database unavailable")

    try:
        await rpc.validate_contract()
        chain_id = await rpc.chain_id()
        expected = settings.botchain_testnet_chain_id
        if chain_id == expected:
            chain = ComponentHealth(status="ok", detail=f"chain_id={chain_id}")
        else:
            chain = ComponentHealth(
                status="error",
                detail=f"expected chain_id={expected}, received {chain_id}",
            )
    except RpcError:
        chain = ComponentHealth(status="error", detail="RPC unavailable")

    ai = ComponentHealth(
        status="ok" if primary_extractor else "fallback",
        detail=settings.ai_model if primary_extractor else "manual/deterministic extraction enabled",
    )
    overall = "ok" if database.status == "ok" and chain.status == "ok" else "degraded"
    return HealthResponse(
        status=overall,
        app_env=settings.app_env,
        database=database,
        ai_provider=ai,
        botchain_rpc=chain,
    )
