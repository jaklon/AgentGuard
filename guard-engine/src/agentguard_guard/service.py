from __future__ import annotations

from .extractors import IntentExtractionError, IntentExtractor, ManualIntentExtractor
from .models import GuardDecision, PaymentIntent, PolicySnapshot
from .policy import PolicyEvaluator


class GuardService:
    def __init__(
        self,
        *,
        primary_extractor: IntentExtractor | None = None,
        fallback_extractor: IntentExtractor | None = None,
        evaluator: PolicyEvaluator | None = None,
    ) -> None:
        self._primary = primary_extractor
        self._fallback = fallback_extractor or ManualIntentExtractor()
        self._evaluator = evaluator or PolicyEvaluator()

    async def evaluate(
        self,
        *,
        prompt: str | None,
        policy: PolicySnapshot,
        manual_intent: PaymentIntent | None = None,
    ) -> GuardDecision:
        extraction_warnings: list[str] = []
        if manual_intent is not None:
            intent = manual_intent
            source = "manual"
        elif not prompt:
            raise IntentExtractionError("Provide either a prompt or a manual payment intent")
        elif self._primary is not None:
            try:
                intent = await self._primary.extract(prompt, policy.chain_id)
                source = "openai"
            except Exception:
                intent = await self._fallback.extract(prompt, policy.chain_id)
                source = "deterministic"
                extraction_warnings.append("AI provider unavailable; deterministic extraction was used")
        else:
            intent = await self._fallback.extract(prompt, policy.chain_id)
            source = "deterministic"
            extraction_warnings.append("AI provider is not configured; deterministic extraction was used")

        return self._evaluator.evaluate(
            intent,
            policy,
            source=source,
            extraction_warnings=extraction_warnings,
        )
