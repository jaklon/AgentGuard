from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from .models import Decision, GuardDecision, PaymentIntent, PolicySnapshot


class PolicyEvaluator:
    def evaluate(
        self,
        intent: PaymentIntent,
        policy: PolicySnapshot,
        *,
        source: str = "deterministic",
        now: datetime | None = None,
        extraction_warnings: list[str] | None = None,
    ) -> GuardDecision:
        checked_at = now or datetime.now(UTC)
        warnings = list(extraction_warnings or [])

        if intent.chain_id != policy.chain_id:
            return self._block(intent, source, 100, "Intent targets the wrong blockchain network", warnings)
        if policy.paused:
            return self._block(intent, source, 100, "Wallet policy is paused", warnings)
        if policy.expires_at is not None and checked_at >= policy.expires_at:
            return self._block(intent, source, 100, "Wallet policy has expired", warnings)
        if policy.allowlist_enforced and intent.recipient.lower() not in {
            address.lower() for address in policy.allowed_recipients
        }:
            return self._block(intent, source, 95, "Recipient is not on the wallet allowlist", warnings)
        if intent.amount_bot > policy.per_transaction_limit_bot:
            return self._block(
                intent,
                source,
                92,
                "Payment exceeds the configured transaction limit",
                warnings,
            )
        if policy.spent_today_bot + intent.amount_bot > policy.daily_limit_bot:
            return self._block(intent, source, 90, "Payment exceeds the remaining daily limit", warnings)

        ratio = intent.amount_bot / policy.per_transaction_limit_bot
        if ratio >= Decimal("0.8"):
            warnings.append("Payment uses at least 80% of the per-transaction limit")
            return GuardDecision(
                decision=Decision.WARN,
                risk_score=min(79, 50 + int(ratio * 25)),
                reason="Payment is valid but close to the configured transaction limit",
                intent=intent,
                warnings=warnings,
                source=source,
            )

        return GuardDecision(
            decision=Decision.ALLOW,
            risk_score=max(5, int(ratio * 40)),
            reason="Payment satisfies the deterministic wallet policy",
            intent=intent,
            warnings=warnings,
            source=source,
        )

    @staticmethod
    def _block(
        intent: PaymentIntent,
        source: str,
        score: int,
        reason: str,
        warnings: list[str],
    ) -> GuardDecision:
        return GuardDecision(
            decision=Decision.BLOCK,
            risk_score=score,
            reason=reason,
            intent=intent,
            warnings=warnings,
            source=source,
        )
