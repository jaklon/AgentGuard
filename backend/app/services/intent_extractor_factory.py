from app.config import settings
from app.services.intent_extractor import IntentExtractor
from app.services.mock_intent_extractor import MockIntentExtractor
from app.services.ollama_intent_extractor import OllamaIntentExtractor


def get_intent_extractor() -> IntentExtractor:
    provider = settings.ai_provider.lower()

    if provider == "ollama":
        return OllamaIntentExtractor()

    if provider == "mock":
        return MockIntentExtractor()

    raise ValueError(f"Unsupported AI provider: {settings.ai_provider}")