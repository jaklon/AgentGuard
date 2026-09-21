import json

import httpx
from pydantic import ValidationError

from app.config import settings
from app.schemas.guard import PaymentIntent
from app.services.intent_extractor import IntentExtractor


class AIExtractionError(Exception):
    """Raised when AI cannot produce a valid payment intent."""


class OllamaIntentExtractor(IntentExtractor):
    def extract(self, instruction: str) -> PaymentIntent:
        prompt = f"""
You are an intent extraction component for AgentGuard.

Your ONLY task is to extract payment intent from the user's instruction.

You MUST return valid JSON with exactly these fields:

{{
  "action": "payment",
  "recipient": "0x...",
  "amount_bot": "0.01",
  "network": "BOT Chain",
  "purpose": "..."
}}

Rules:
- Do NOT make a security decision.
- Do NOT return ALLOW, WARN, or BLOCK.
- Do NOT invent missing information.
- amount_bot MUST be a decimal string.
- recipient MUST be copied from the instruction if present.
- Preserve uncertain or malformed values so the deterministic Guard Engine can reject them.
- Return JSON only.
- No markdown.
- No explanation.

User instruction:
{instruction}
""".strip()

        payload = {
            "model": settings.ai_model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            "stream": False,
            "format": {
                "type": "object",
                "properties": {
                    "action": {"type": "string"},
                    "recipient": {"type": "string"},
                    "amount_bot": {"type": "string"},
                    "network": {"type": "string"},
                    "purpose": {"type": "string"},
                },
                "required": [
                    "action",
                    "recipient",
                    "amount_bot",
                    "network",
                    "purpose",
                ],
            },
        }

        url = f"{settings.ollama_base_url.rstrip('/')}/api/chat"

        try:
            with httpx.Client(timeout=settings.model_timeout_seconds) as client:
                response = client.post(url, json=payload)
                response.raise_for_status()
        except (httpx.HTTPError, httpx.TimeoutException) as exc:
            raise AIExtractionError(
                "AI provider is unavailable"
            ) from exc

        try:
            response_data = response.json()
            content = response_data["message"]["content"]
            extracted = json.loads(content)
            return PaymentIntent.model_validate(extracted)
        except (KeyError, TypeError, ValueError, ValidationError) as exc:
            raise AIExtractionError(
                "AI provider returned an invalid intent"
            ) from exc