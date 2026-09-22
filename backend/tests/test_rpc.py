import pytest
from eth_abi import encode

from app.config import Settings
from app.rpc import BotChainRpc, CONTRACT_ERRORS, PAYMENT_EXECUTED_TOPIC, contract_error_message


def test_translates_known_contract_revert_selector() -> None:
    selector = next(
        selector
        for selector, message in CONTRACT_ERRORS.items()
        if message == "Recipient is not on the wallet allowlist"
    )
    assert contract_error_message(
        {"code": 3, "message": f"execution reverted: {selector}"}
    ) == "Recipient is not on the wallet allowlist"


def test_preserves_unknown_rpc_error_message() -> None:
    assert contract_error_message(
        {"code": -32000, "message": "upstream rejected the request"}
    ) == "upstream rejected the request"


@pytest.mark.asyncio
async def test_decodes_payment_history_event(monkeypatch: pytest.MonkeyPatch) -> None:
    contract = "0x3333333333333333333333333333333333333333"
    payer = "0x1111111111111111111111111111111111111111"
    recipient = "0x2222222222222222222222222222222222222222"
    tx_hash = "0x" + ("ab" * 32)
    intent_hash = "0x" + ("cd" * 32)
    client = BotChainRpc(Settings(botchain_contract_address=contract))

    async def call(method: str, _params: list):
        if method == "eth_getLogs":
            first = {
                "topics": [
                    PAYMENT_EXECUTED_TOPIC,
                    "0x" + payer.removeprefix("0x").rjust(64, "0"),
                    "0x" + recipient.removeprefix("0x").rjust(64, "0"),
                    intent_hash,
                ],
                "data": "0x" + encode(["uint256", "bool"], [10**16, False]).hex(),
                "blockNumber": "0x2a",
                "logIndex": "0x1",
                "transactionHash": tx_hash,
                "removed": False,
            }
            return [
                first,
                {**first, "logIndex": "0x0", "transactionHash": "0x" + ("ef" * 32)},
            ]
        if method == "eth_getBlockByNumber":
            return {"timestamp": "0x68d26c00"}
        raise AssertionError(method)

    monkeypatch.setattr(client, "call", call)
    items, total, total_count, recipient_totals = await client.payment_history(payer, limit=1)
    assert len(items) == 1
    assert items[0]["recipient"].lower() == recipient.lower()
    assert str(items[0]["amount_bot"]) == "0.01"
    assert items[0]["transaction_hash"] == tx_hash
    assert str(total) == "0.02"
    assert total_count == 2
    assert recipient_totals[recipient][0] == 2
