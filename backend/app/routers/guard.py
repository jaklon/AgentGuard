from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import GuardEvaluation
from app.schemas.guard import (
    GuardEvaluateRequest,
    GuardEvaluateResponse,
)
from app.services.guard_engine import evaluate_intent
from app.services.intent_extractor_factory import get_intent_extractor
from app.services.ollama_intent_extractor import AIExtractionError
from app.services.rate_limiter import enforce_rate_limit


router = APIRouter(
    prefix="/api/guard",
    tags=["Guard"],
)


@router.post("/evaluate", response_model=GuardEvaluateResponse)
def evaluate_guard(
    request: GuardEvaluateRequest,
    db: Session = Depends(get_db),
    _: None = Depends(enforce_rate_limit),
):
    extractor = get_intent_extractor()

    try:
        intent = extractor.extract(request.instruction)
    except AIExtractionError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        ) from exc

    try:
        decision, risk_score, reason = evaluate_intent(intent)

        evaluation = GuardEvaluation(
            instruction=request.instruction,
            action=intent.action,
            recipient=intent.recipient,
            amount_bot=intent.amount_bot,
            network=intent.network,
            purpose=intent.purpose,
            decision=decision,
            risk_score=risk_score,
            reason=reason,
            transaction_hash=None,
        )

        db.add(evaluation)
        db.commit()

    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to persist guard evaluation",
        ) from exc

    return GuardEvaluateResponse(
        decision=decision,
        risk_score=risk_score,
        reason=reason,
        intent=intent,
        transaction_hash=None,
    )