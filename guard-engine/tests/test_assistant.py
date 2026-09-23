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
        assert "Berapa saldo saya?" in payload["messages"][-1]["content"]
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
            question="Berapa saldo saya?",
            conversation=[{"role": "assistant", "content": "Silakan bertanya."}],
            live_context={"balance_bot": "1.25"},
        )

    assert answer == "Saldo Anda 1.25 BOT."


@pytest.mark.asyncio
async def test_qwen_assistant_reports_invalid_completion() -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _request: httpx.Response(200, json={"choices": []})),
        base_url="http://llm",
    ) as client:
        assistant = LlamaCppAssistant(base_url="http://llm", model="Qwen", client=client)
        with pytest.raises(AssistantCompletionError, match="temporarily unavailable"):
            await assistant.chat(question="hello", conversation=[], live_context={})
