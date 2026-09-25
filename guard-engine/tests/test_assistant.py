import json

import httpx
import pytest

from agentguard_guard import AssistantCompletionError, LlamaCppAssistant


@pytest.mark.asyncio
async def test_qwen_assistant_receives_grounded_context_and_strips_reasoning() -> None:
    def responder(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/chat/completions"
        payload = json.loads(request.content)
        assert payload["model"] == "Qwen3-4B-Instruct-2507-Q4_K_M.gguf"
        assert payload["messages"][0]["role"] == "system"
        assert "only source of truth" in payload["messages"][0]["content"]
        assert '"balance_bot":"1.25"' in payload["messages"][-1]["content"]
        assert "Jelaskan saldo dan policy saya" in payload["messages"][-1]["content"]
        assert payload["max_tokens"] == 320
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "<think>hidden</think>Saldo Anda 1.25 BOT."}}]},
        )

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(responder), base_url="http://llm"
    ) as client:
        assistant = LlamaCppAssistant(
            base_url="http://llm",
            model="Qwen3-4B-Instruct-2507-Q4_K_M.gguf",
            client=client,
        )
        answer = await assistant.chat(
            question="Jelaskan saldo dan policy saya",
            conversation=[{"role": "assistant", "content": "Silakan bertanya."}],
            live_context={"balance_bot": "1.25"},
        )

    assert answer == "Saldo Anda 1.25 BOT."


@pytest.mark.asyncio
async def test_balance_answer_skips_model_but_does_not_approve_payments() -> None:
    from agentguard_guard.assistant import grounded_quick_answer
    calls = []
    def responder(request):
        calls.append(request)
        return httpx.Response(500)
    async with httpx.AsyncClient(transport=httpx.MockTransport(responder), base_url="http://llm") as client:
        assistant = LlamaCppAssistant(base_url="http://llm", model="Qwen", client=client)
        answer = await assistant.chat(question="Berapa saldo saya?", conversation=[], live_context={"balance_bot": "1.25"})
    assert "1.25 BOT" in answer
    assert not calls
    assert grounded_quick_answer("Berapa saldo saya? Apakah aman mengirim semuanya?", {"balance_bot": "1.25"}) is None


def test_unfinished_reasoning_is_never_shown():
    from agentguard_guard.assistant import strip_hidden_reasoning
    assert strip_hidden_reasoning("<think>unfinished private reasoning") == ""
    assert strip_hidden_reasoning("Answer <think>unfinished") == "Answer"


@pytest.mark.asyncio
async def test_qwen_assistant_reports_invalid_completion() -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _request: httpx.Response(200, json={"choices": []})),
        base_url="http://llm",
    ) as client:
        assistant = LlamaCppAssistant(base_url="http://llm", model="Qwen", client=client)
        with pytest.raises(AssistantCompletionError, match="temporarily unavailable"):
            await assistant.chat(question="hello", conversation=[], live_context={})
