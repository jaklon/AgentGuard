from __future__ import annotations

import asyncio
import hashlib
import re
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from decimal import Decimal

from agentguard_guard import (
    AssistantCompletionError,
    GuardDecision,
    GuardService,
    grounded_quick_answer,
    IntentExtractionError,
    LlamaCppAssistant,
    LlamaCppIntentExtractor,
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
    AssistantChatRequest,
    AssistantChatResponse,
    ComponentHealth,
    GuardEvaluateRequest,
    HealthResponse,
    PaymentHistoryItem,
    PaymentHistoryResponse,
    PublicConfigResponse,
    RecipientAlias,
    RecipientPaymentSummary,
    SimulateRequest,
    SimulateResponse,
    TransactionStatus,
    WalletActivityResponse,
    WalletReadinessResponse,
    WalletTransactionItem,
)

settings = get_settings()
configure_logging(settings.log_level)
rpc = BotChainRpc(settings)

primary_extractor = None
local_extractor: LlamaCppIntentExtractor | None = None
ai_assistant: LlamaCppAssistant | None = None
if settings.ai_provider == "openai" and settings.openai_api_key:
    primary_extractor = OpenAIIntentExtractor(
        api_key=settings.openai_api_key,
        model=settings.ai_model,
        timeout_seconds=settings.model_timeout_seconds,
    )
elif settings.ai_provider == "llama_cpp":
    local_extractor = LlamaCppIntentExtractor(
        base_url=settings.local_llm_base_url,
        model=settings.ai_model,
        timeout_seconds=settings.model_timeout_seconds,
    )
    primary_extractor = local_extractor
    ai_assistant = LlamaCppAssistant(
        base_url=settings.local_llm_base_url,
        model=settings.ai_model,
        timeout_seconds=settings.model_timeout_seconds,
    )
guard = GuardService(
    primary_extractor=primary_extractor,
    primary_source="local" if local_extractor else "openai",
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    try:
        yield
    finally:
        if local_extractor:
            await local_extractor.aclose()
        if ai_assistant:
            await ai_assistant.aclose()


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
        resolved_prompt, expected_recipient = resolve_recipient_aliases(
            payload.prompt, payload.recipient_aliases
        )
        result = await guard.evaluate(
            prompt=resolved_prompt,
            policy=policy,
            manual_intent=payload.manual_intent,
        )
    except IntentExtractionError as exc:
        raise HTTPException(
            status_code=422,
            detail={"code": "INTENT_INVALID", "message": str(exc)},
        ) from exc

    if expected_recipient and (
        result.intent is None or result.intent.recipient.lower() != expected_recipient.lower()
    ):
        raise HTTPException(
            status_code=422,
            detail={
                "code": "RECIPIENT_MISMATCH",
                "message": "Could not safely match the payment to the selected trusted recipient",
            },
        )

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


@app.post("/api/assistant/chat", response_model=AssistantChatResponse)
async def chat_with_assistant(payload: AssistantChatRequest) -> AssistantChatResponse:
    """Answer naturally while grounding wallet claims in fresh BOT Chain reads."""
    if grounded_quick_answer(payload.question, {"balance_bot": ""}) is not None:
        try:
            balance_wei, chain_id = await asyncio.gather(
                rpc.balance_wei(payload.wallet),
                rpc.chain_id(),
            )
            if chain_id != settings.botchain_chain_id:
                raise RpcError("BOT Chain RPC returned an unexpected chain ID")
        except RpcError as exc:
            raise HTTPException(
                status_code=503,
                detail={"code": "LIVE_DATA_UNAVAILABLE", "message": str(exc)},
            ) from exc
        answer = grounded_quick_answer(payload.question, {
            "balance_bot": format(Decimal(balance_wei) / Decimal(10**18), "f"),
            "network": {"name": settings.botchain_network_name, "chain_id": chain_id},
        })
        return AssistantChatResponse(
            answer=answer or "Live balance is unavailable.",
            model="AgentGuard live balance",
            live_data=True,
            data_as_of=datetime.now(UTC),
            sources=[f"{settings.botchain_network_name} RPC"],
        )
    if ai_assistant is None:
        raise HTTPException(
            status_code=503,
            detail={"code": "ASSISTANT_UNAVAILABLE", "message": "The private AI assistant is not enabled"},
        )

    try:
        history_result, balance_wei, chain_id, policy_result = await asyncio.gather(
            rpc.payment_history(payload.wallet, limit=5),
            rpc.balance_wei(payload.wallet),
            rpc.chain_id(),
            assistant_policy(payload.wallet),
        )
        if chain_id != settings.botchain_chain_id:
            raise RpcError("BOT Chain RPC returned an unexpected chain ID")
    except RpcError as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "LIVE_DATA_UNAVAILABLE", "message": str(exc)},
        ) from exc

    policy, policy_error = policy_result

    history, total_spent, total_count, recipient_totals = history_result
    aliases = {alias.address.lower(): alias.name for alias in payload.recipient_aliases}
    recipient_summaries = [
        {
            "address": address,
            "name": aliases.get(address.lower()),
            "payment_count": count,
            "total_amount_bot": format(total, "f"),
        }
        for address, (count, total) in sorted(
            recipient_totals.items(),
            key=lambda entry: (-entry[1][1], entry[0]),
        )
    ][:5]
    recent_payments = [
        {
            "transaction_hash": item["transaction_hash"],
            "block_number": item["block_number"],
            "timestamp": item["timestamp"].isoformat(),
            "recipient": item["recipient"],
            "recipient_name": aliases.get(str(item["recipient"]).lower()),
            "amount_bot": format(item["amount_bot"], "f"),
            "funded_from_balance": item["funded_from_balance"],
            "purpose": None,
        }
        for item in history[:5]
    ]
    data_as_of = datetime.now(UTC)
    live_context = {
        "data_as_of": data_as_of.isoformat(),
        "wallet": payload.wallet,
        "network": {
            "name": settings.botchain_network_name,
            "chain_id": chain_id,
            "expected_chain_id": settings.botchain_chain_id,
            "explorer_url": settings.botchain_explorer_url,
        },
        "balance_bot": format(Decimal(balance_wei) / Decimal(10**18), "f"),
        "policy": None if policy is None else {
            "per_transaction_limit_bot": format(policy.per_transaction_limit_bot, "f"),
            "daily_limit_bot": format(policy.daily_limit_bot, "f"),
            "spent_today_bot": format(policy.spent_today_bot, "f"),
            "expires_at": policy.expires_at.isoformat() if policy.expires_at else None,
            "allowlist_enforced": policy.allowlist_enforced,
            "allowed_recipients": [
                {"address": address, "name": aliases.get(address.lower())}
                for address in policy.allowed_recipients[:20]
            ],
            "paused": policy.paused,
        },
        "policy_status": "available" if policy else "unavailable",
        "policy_error": policy_error,
        "history": {
            "confirmed_payment_count": total_count,
            "total_spent_bot": format(total_spent, "f"),
            "recipient_summaries": recipient_summaries,
            "recent_payments": recent_payments,
        },
        "limitations": [
            "Contract events do not store payment purposes or memos.",
            "Only the latest 5 payments and top 5 recipients are included in this chat context; aggregate totals cover all confirmed AgentGuard payments, not every wallet transfer.",
            "The assistant cannot sign, submit, reverse, or guarantee transactions.",
        ],
    }

    try:
        answer = await ai_assistant.chat(
            question=payload.question,
            conversation=[
                {"role": item.role, "content": item.text}
                for item in payload.conversation
            ],
            live_context=live_context,
        )
    except AssistantCompletionError as exc:
        raise HTTPException(
            status_code=502,
            detail={"code": "ASSISTANT_COMPLETION_FAILED", "message": str(exc)},
        ) from exc

    sources = [f"{settings.botchain_network_name} RPC", "AgentGuard contract events"]
    if policy is not None:
        sources.append("AgentGuard Safety Policy")
    return AssistantChatResponse(
        answer=answer,
        model="private-local-model",
        live_data=True,
        data_as_of=data_as_of,
        sources=sources,
    )


ADDRESS_PATTERN = re.compile(r"0x[a-fA-F0-9]{40}")

async def assistant_policy(wallet: str):
    """Read optional policy concurrently with the other assistant context."""
    try:
        return await rpc.policy(wallet), None
    except RpcError as exc:
        return None, str(exc)



def resolve_recipient_aliases(
    prompt: str | None, aliases: list[RecipientAlias]
) -> tuple[str | None, str | None]:
    """Replace one saved name with its address before intent extraction.

    An alias is client-owned convenience data, never an authorization mechanism:
    the extracted address is still compared to it and checked against the on-chain policy.
    """
    if prompt is None:
        return None, None
    explicit_addresses = list(dict.fromkeys(ADDRESS_PATTERN.findall(prompt)))
    normalized: dict[str, RecipientAlias] = {}
    for alias in aliases:
        key = alias.name.casefold()
        if key in normalized and normalized[key].address.lower() != alias.address.lower():
            raise IntentExtractionError("Recipient names must be unique")
        normalized[key] = alias

    matches: list[RecipientAlias] = []
    for alias in sorted(normalized.values(), key=lambda value: len(value.name), reverse=True):
        pattern = re.compile(rf"(?<![\w-]){re.escape(alias.name)}(?![\w-])", re.IGNORECASE)
        if pattern.search(prompt):
            matches.append(alias)

    matched_addresses = {alias.address.lower() for alias in matches}
    if explicit_addresses and matches:
        raise IntentExtractionError("Use either one trusted recipient name or one wallet address, not both")
    if len(explicit_addresses) > 1 or len(matched_addresses) > 1:
        raise IntentExtractionError("Choose exactly one recipient")
    if explicit_addresses:
        return prompt, explicit_addresses[0]
    if not matches:
        if aliases:
            raise IntentExtractionError("Recipient not recognized. Choose a saved trusted recipient name")
        return prompt, None

    recipient = matches[0]
    pattern = re.compile(rf"(?<![\w-]){re.escape(recipient.name)}(?![\w-])", re.IGNORECASE)
    return pattern.sub(recipient.address, prompt), recipient.address


@app.post("/api/botchain/simulate", response_model=SimulateResponse)
async def simulate_transaction(payload: SimulateRequest) -> SimulateResponse:
    try:
        gas = await rpc.simulate(
            wallet=payload.wallet,
            recipient=payload.recipient,
            amount_bot=payload.amount_bot,
            intent_hash=payload.intent_hash,
        )
        balance_wei = await rpc.balance_wei(payload.wallet)
        gas_price_wei = await rpc.gas_price_wei()
    except RpcError as exc:
        return SimulateResponse(allowed=False, reason=str(exc), estimated_gas=None)
    amount_wei = rpc._to_wei(payload.amount_bot)
    estimated_fee_wei = gas * gas_price_wei
    balance_after_wei = balance_wei - amount_wei - estimated_fee_wei
    if balance_after_wei < 0:
        return SimulateResponse(
            allowed=False,
            reason="Wallet balance is insufficient for the payment and estimated gas fee",
            estimated_gas=gas,
            estimated_fee_bot=format(Decimal(estimated_fee_wei) / Decimal(10**18), "f"),
            wallet_balance_bot=format(Decimal(balance_wei) / Decimal(10**18), "f"),
            balance_after_bot=format(Decimal(balance_after_wei) / Decimal(10**18), "f"),
            contract_address=settings.botchain_contract_address,
        )
    return SimulateResponse(
        allowed=True,
        reason="Contract simulation succeeded",
        estimated_gas=gas,
        estimated_fee_bot=format(Decimal(estimated_fee_wei) / Decimal(10**18), "f"),
        wallet_balance_bot=format(Decimal(balance_wei) / Decimal(10**18), "f"),
        balance_after_bot=format(Decimal(balance_after_wei) / Decimal(10**18), "f"),
        contract_address=settings.botchain_contract_address,
    )


@app.get("/api/config", response_model=PublicConfigResponse)
async def public_config() -> PublicConfigResponse:
    if not settings.botchain_contract_address:
        raise HTTPException(
            status_code=503,
            detail={"code": "CONTRACT_UNAVAILABLE", "message": "Contract address is not configured"},
        )
    return PublicConfigResponse(
        chain_id=settings.botchain_chain_id,
        chain_name=settings.botchain_network_name,
        rpc_url=settings.botchain_rpc_url,
        explorer_url=settings.botchain_explorer_url,
        contract_address=settings.botchain_contract_address,
        allocation_wallet=settings.botchain_allocation_wallet,
        faucet_url=settings.botchain_faucet_url,
        bundler_url=settings.botchain_bundler_url,
        entry_point=settings.botchain_entry_point,
        # A reachable bundler is not enough: this release does not yet submit
        # ERC-4337 UserOperations through a funded project paymaster.
        gasless_available=False,
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
        explorer_url=f"{settings.botchain_explorer_url}/tx/{transaction_hash}",
    )


@app.get("/api/botchain/history/{wallet}", response_model=PaymentHistoryResponse)
async def get_payment_history(
    wallet: str = Path(pattern=r"^0x[a-fA-F0-9]{40}$"),
    include_wallet_activity: bool = True,
) -> PaymentHistoryResponse:
    try:
        history, total, total_count, recipient_totals = await rpc.payment_history(wallet)
    except RpcError as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "HISTORY_UNAVAILABLE", "message": str(exc)},
        ) from exc
    try:
        if not include_wallet_activity:
            raise RpcError("Wallet-wide activity was not requested")
        activity = await rpc.wallet_history(wallet)
        activity_error = None
    except RpcError as exc:
        activity = {
            "available": False,
            "complete": False,
            "total_count": 0,
            "incoming_count": 0,
            "outgoing_count": 0,
            "total_received_bot": Decimal(0),
            "total_sent_bot": Decimal(0),
            "items": [],
        }
        activity_error = str(exc)
    items = [
        PaymentHistoryItem(
            **{**item, "amount_bot": format(item["amount_bot"], "f")},
            explorer_url=f"{settings.botchain_explorer_url}/tx/{item['transaction_hash']}",
        )
        for item in history
    ]
    recipient_summaries = [
        RecipientPaymentSummary(
            recipient=recipient,
            payment_count=payment_count,
            total_amount_bot=format(total_amount, "f"),
        )
        for recipient, (payment_count, total_amount) in sorted(
            recipient_totals.items(),
            key=lambda entry: (-entry[1][1], entry[0]),
        )
    ]
    return PaymentHistoryResponse(
        wallet=wallet,
        total_count=total_count,
        total_spent_bot=format(total, "f"),
        recipient_summaries=recipient_summaries,
        items=items,
        wallet_activity=WalletActivityResponse(
            available=activity["available"],
            complete=activity["complete"],
            error=activity_error,
            total_count=activity["total_count"],
            incoming_count=activity["incoming_count"],
            outgoing_count=activity["outgoing_count"],
            total_received_bot=format(activity["total_received_bot"], "f"),
            total_sent_bot=format(activity["total_sent_bot"], "f"),
            items=[
                WalletTransactionItem(
                    **{
                        **item,
                        "amount_bot": format(item["amount_bot"], "f"),
                        "fee_bot": format(item["fee_bot"], "f"),
                    },
                    explorer_url=f"{settings.botchain_explorer_url}/tx/{item['transaction_hash']}",
                )
                for item in activity["items"]
            ],
        ),
    )


@app.get("/api/botchain/readiness/{wallet}", response_model=WalletReadinessResponse)
async def get_wallet_readiness(
    wallet: str = Path(pattern=r"^0x[a-fA-F0-9]{40}$"),
) -> WalletReadinessResponse:
    try:
        balance_wei = await rpc.balance_wei(wallet)
        chain_id = await rpc.chain_id()
        if chain_id != settings.botchain_chain_id:
            raise RpcError("BOT Chain RPC returned an unexpected chain ID")
    except RpcError as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "READINESS_UNAVAILABLE", "message": str(exc)},
        ) from exc
    bundler_available = False
    if settings.botchain_bundler_url:
        try:
            entry_points = await rpc.bundler_entry_points()
            bundler_available = settings.botchain_entry_point.lower() in {
                entry_point.lower() for entry_point in entry_points
            }
        except RpcError:
            bundler_available = False
    return WalletReadinessResponse(
        wallet=wallet,
        balance_bot=format(Decimal(balance_wei) / Decimal(10**18), "f"),
        chain_id=chain_id,
        bundler_available=bundler_available,
        gasless_available=False,
        entry_point=settings.botchain_entry_point,
        faucet_url=settings.botchain_faucet_url,
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
        expected = settings.botchain_chain_id
        if chain_id == expected:
            chain = ComponentHealth(status="ok", detail=f"chain_id={chain_id}")
        else:
            chain = ComponentHealth(
                status="error",
                detail=f"expected chain_id={expected}, received {chain_id}",
            )
    except RpcError:
        chain = ComponentHealth(status="error", detail="RPC unavailable")

    if local_extractor:
        try:
            await local_extractor.check_health()
            ai = ComponentHealth(status="ok", detail="local private inference")
        except IntentExtractionError:
            ai = ComponentHealth(status="error", detail="local llama.cpp unavailable")
    else:
        ai = ComponentHealth(
            status="ok" if primary_extractor else "fallback",
            detail="private AI inference" if primary_extractor else "manual/deterministic extraction enabled",
        )
    overall = "ok" if database.status == "ok" and chain.status == "ok" and ai.status != "error" else "degraded"
    return HealthResponse(
        status=overall,
        app_env=settings.app_env,
        database=database,
        ai_provider=ai,
        botchain_rpc=chain,
    )
