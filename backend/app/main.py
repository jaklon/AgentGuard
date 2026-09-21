from __future__ import annotations

import hashlib
import re
from contextlib import asynccontextmanager

from agentguard_guard import (
    GuardDecision,
    GuardService,
    IntentExtractionError,
    OpenAIIntentExtractor,
)
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db, init_db
from .logging import configure_logging
from .middleware import RateLimitMiddleware, RequestContextMiddleware, RequestLimitMiddleware
from .models import AuditRecord
from .rpc import BotChainRpc, RpcError
from .schemas import (
    ComponentHealth,
    GuardEvaluateRequest,
    HealthResponse,
    SimulateRequest,
    SimulateResponse,
    TransactionStatus,
)
from .schemas.botchain import (
    BotChainPolicyResponse,
    BotChainSimulateRequest,
    BotChainSimulateResponse,
    BotChainTransactionResponse,
)
from .schemas.guard import GuardEvaluateRequest as InstructionGuardEvaluateRequest
from .schemas.guard import GuardEvaluateResponse
from .schemas.api import GuardEvaluateRequest as LegacyGuardEvaluateRequest
from .services.guard_engine import evaluate_intent
from .services.mock_botchain_adapter import MockBotChainAdapter
from .services.mock_intent_extractor import MockIntentExtractor

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


@app.post("/api/guard/evaluate")
async def evaluate_guard(
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    if "instruction" in payload:
        try:
            instruction_request = InstructionGuardEvaluateRequest.model_validate(payload)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="Request validation failed") from exc

        intent = MockIntentExtractor().extract(instruction_request.instruction)
        decision, risk_score, reason = evaluate_intent(intent)
        return GuardEvaluateResponse(
            decision=decision,
            risk_score=risk_score,
            reason=reason,
            intent=intent,
        ).model_dump(mode="json")

    try:
        legacy_payload = LegacyGuardEvaluateRequest.model_validate(payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Request validation failed") from exc

    try:
        result = await guard.evaluate(
            prompt=legacy_payload.prompt,
            policy=legacy_payload.policy,
            manual_intent=legacy_payload.manual_intent,
        )
    except IntentExtractionError as exc:
        raise HTTPException(
            status_code=422,
            detail={"code": "INTENT_INVALID", "message": str(exc)},
        ) from exc

    prompt_hash = (
        hashlib.sha256(legacy_payload.prompt.encode("utf-8")).hexdigest()
        if legacy_payload.prompt
        else None
    )
    db.add(
        AuditRecord(
            request_id=request.state.request_id,
            wallet=legacy_payload.policy.wallet,
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
    return result.model_dump(mode="json")


@app.post("/api/botchain/simulate", response_model=BotChainSimulateResponse)
async def simulate_transaction(payload: BotChainSimulateRequest) -> dict:
    return MockBotChainAdapter().simulate_payment(
        wallet=payload.wallet,
        recipient=payload.recipient,
        amount_bot=payload.amount_bot,
    )


@app.get("/api/botchain/policy/{wallet}", response_model=BotChainPolicyResponse)
async def get_policy(wallet: str) -> dict:
    return MockBotChainAdapter().get_policy(wallet)


@app.get("/api/botchain/transaction/{transaction_hash}", response_model=BotChainTransactionResponse)
async def get_transaction(transaction_hash: str) -> dict:
    if not re.fullmatch(r"0x[a-fA-F0-9]{64}", transaction_hash):
        raise HTTPException(status_code=422, detail="Request validation failed")
    return MockBotChainAdapter().get_transaction(transaction_hash)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "agentguard-api"}


@app.get("/api/ready")
async def ready(db: Session = Depends(get_db)) -> dict[str, str]:
    db.execute(text("SELECT 1"))
    return {"status": "ready", "service": "agentguard-api", "database": "ok"}
