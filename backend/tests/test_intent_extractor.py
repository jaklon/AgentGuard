import pytest

from app.services.intent_extractor import IntentExtractor


def test_intent_extractor_is_abstract():
    with pytest.raises(TypeError):
        IntentExtractor()