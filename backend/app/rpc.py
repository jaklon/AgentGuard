from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import httpx
from agentguard_guard import PolicySnapshot
from eth_abi import decode, encode
from eth_utils import keccak

from .config import Settings

WEI_PER_BOT = Decimal(10**18)
PAYMENT_EXECUTED_TOPIC = "0x" + keccak(
    text="PaymentExecuted(address,address,uint256,bytes32,bool)"
).hex()
CONTRACT_ERRORS = {
    "0x" + keccak(text=signature)[:4].hex(): message
    for signature, message in {
        "InvalidAmount()": "Payment amount must be greater than zero",
        "InvalidPolicy()": "Wallet policy is not configured or is invalid",
        "PolicyExpired()": "Wallet policy has expired",
        "WalletPaused()": "Wallet payments are paused",
        "RecipientNotAllowed()": "Recipient is not on the wallet allowlist",
        "TransactionLimitExceeded()": "Payment exceeds the per-transaction limit",
        "DailyLimitExceeded()": "Payment exceeds the remaining daily limit",
        "IntentAlreadyUsed()": "This payment intent has already been used",
        "InvalidIntentHash()": "Payment intent identifier is invalid",
        "TooManyRecipients()": "Recipient allowlist has reached its maximum size",
        "TransferFailed()": "BOT transfer failed",
        "InsufficientBalance()": "Wallet contract balance is insufficient",
    }.items()
}


class RpcError(RuntimeError):
    pass


class BotChainRpc:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def call(self, method: str, params: list[Any]) -> Any:
        return await self._call_url(self._settings.botchain_testnet_rpc_url, method, params)

    async def _call_url(self, url: str, method: str, params: list[Any]) -> Any:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.post(
                    url,
                    json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
                )
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise RpcError("BOT Chain RPC is unavailable") from exc
        if payload.get("error"):
            raise RpcError(contract_error_message(payload["error"]))
        return payload.get("result")

    async def chain_id(self) -> int:
        result = await self.call("eth_chainId", [])
        return int(result, 16)

    async def contract_code(self) -> str:
        return await self.call("eth_getCode", [self._require_contract(), "latest"])

    async def validate_contract(self) -> None:
        if await self.chain_id() != self._settings.botchain_testnet_chain_id:
            raise RpcError("BOT Chain RPC returned an unexpected chain ID")
        code = await self.contract_code()
        if not isinstance(code, str) or code == "0x":
            raise RpcError("AgentGuard contract bytecode is not deployed at the configured address")

    async def policy(self, wallet: str) -> PolicySnapshot:
        contract = self._require_contract()
        encoded_wallet = encode(["address"], [wallet]).hex()
        policy_data = "0x" + keccak(text="policyOf(address)")[:4].hex() + encoded_wallet
        recipients_data = "0x" + keccak(text="allowedRecipients(address)")[:4].hex() + encoded_wallet
        raw_policy = await self.call("eth_call", [{"to": contract, "data": policy_data}, "latest"])
        raw_recipients = await self.call(
            "eth_call",
            [{"to": contract, "data": recipients_data}, "latest"],
        )
        try:
            per_tx, daily, expires, paused, enforced, spent = decode(
                ["uint256", "uint256", "uint64", "bool", "bool", "uint256"],
                bytes.fromhex(raw_policy.removeprefix("0x")),
            )
            (recipients,) = decode(
                ["address[]"],
                bytes.fromhex(raw_recipients.removeprefix("0x")),
            )
        except (ValueError, TypeError) as exc:
            raise RpcError("Contract returned an invalid policy response") from exc

        if per_tx == 0 or daily == 0:
            raise RpcError("Wallet policy has not been configured")
        return PolicySnapshot(
            wallet=wallet,
            chain_id=self._settings.botchain_testnet_chain_id,
            per_transaction_limit_bot=self._from_wei(per_tx),
            daily_limit_bot=self._from_wei(daily),
            spent_today_bot=self._from_wei(spent),
            expires_at=datetime.fromtimestamp(expires, UTC) if expires else None,
            allowlist_enforced=enforced,
            allowed_recipients=list(recipients),
            paused=paused,
        )

    async def simulate(
        self,
        *,
        wallet: str,
        recipient: str,
        amount_bot: Decimal,
        intent_hash: str,
    ) -> int:
        contract = self._require_contract()
        selector = keccak(text="executePayment(address,bytes32)")[:4]
        arguments = encode(
            ["address", "bytes32"],
            [recipient, bytes.fromhex(intent_hash.removeprefix("0x"))],
        )
        transaction = {
            "from": wallet,
            "to": contract,
            "data": "0x" + (selector + arguments).hex(),
            "value": hex(self._to_wei(amount_bot)),
        }
        result = await self.call("eth_estimateGas", [transaction])
        return int(result, 16)

    async def transaction_receipt(self, transaction_hash: str) -> dict[str, Any] | None:
        return await self.call("eth_getTransactionReceipt", [transaction_hash])

    async def balance_wei(self, wallet: str) -> int:
        result = await self.call("eth_getBalance", [wallet, "latest"])
        return int(result, 16)

    async def gas_price_wei(self) -> int:
        result = await self.call("eth_gasPrice", [])
        return int(result, 16)

    async def bundler_entry_points(self) -> list[str]:
        result = await self._call_url(
            self._settings.botchain_bundler_url,
            "eth_supportedEntryPoints",
            [],
        )
        if not isinstance(result, list):
            raise RpcError("BOT Chain bundler returned an invalid response")
        return [str(value) for value in result]

    async def payment_history(
        self,
        wallet: str,
        *,
        limit: int = 50,
    ) -> tuple[
        list[dict[str, Any]],
        Decimal,
        int,
        dict[str, tuple[int, Decimal]],
    ]:
        payer_topic = "0x" + wallet.removeprefix("0x").lower().rjust(64, "0")
        logs = await self.call(
            "eth_getLogs",
            [{
                "fromBlock": hex(self._settings.botchain_contract_deployment_block),
                "toBlock": "latest",
                "address": self._require_contract(),
                "topics": [PAYMENT_EXECUTED_TOPIC, payer_topic],
            }],
        )
        if not isinstance(logs, list):
            raise RpcError("BOT Chain returned an invalid payment history")
        sortable: list[tuple[int, int, dict[str, Any]]] = []
        for log in logs:
            if not isinstance(log, dict) or log.get("removed"):
                continue
            try:
                sortable.append((
                    int(str(log["blockNumber"]), 16),
                    int(str(log["logIndex"]), 16),
                    log,
                ))
            except (KeyError, TypeError, ValueError):
                continue

        decoded: list[tuple[dict[str, Any], int, bool, str]] = []
        total = Decimal(0)
        total_count = 0
        recipient_totals: dict[str, tuple[int, Decimal]] = {}
        for _, _, log in sorted(sortable, key=lambda value: (value[0], value[1]), reverse=True):
            topics = log.get("topics")
            data = log.get("data")
            if not isinstance(topics, list) or len(topics) < 4 or not isinstance(data, str):
                continue
            try:
                amount_wei, funded_from_balance = decode(
                    ["uint256", "bool"],
                    bytes.fromhex(data.removeprefix("0x")),
                )
                recipient = "0x" + str(topics[2])[-40:]
            except (KeyError, TypeError, ValueError):
                continue
            amount_bot = self._from_wei(int(amount_wei))
            total += amount_bot
            total_count += 1
            key = recipient.lower()
            count, recipient_total = recipient_totals.get(key, (0, Decimal(0)))
            recipient_totals[key] = (count + 1, recipient_total + amount_bot)
            if len(decoded) < limit:
                decoded.append((log, int(amount_wei), bool(funded_from_balance), recipient))

        block_hexes = list(dict.fromkeys(str(log["blockNumber"]) for log, _, _, _ in decoded))
        blocks = await asyncio.gather(*(
            self.call("eth_getBlockByNumber", [block_hex, False])
            for block_hex in block_hexes
        ))
        block_times = {
            block_hex: datetime.fromtimestamp(int(block["timestamp"], 16), UTC)
            for block_hex, block in zip(block_hexes, blocks, strict=True)
        }
        items = [{
            "transaction_hash": str(log["transactionHash"]),
            "block_number": int(str(log["blockNumber"]), 16),
            "timestamp": block_times[str(log["blockNumber"])],
            "payer": "0x" + str(log["topics"][1])[-40:],
            "recipient": recipient,
            "amount_bot": self._from_wei(amount_wei),
            "intent_hash": str(log["topics"][3]),
            "funded_from_balance": funded_from_balance,
        } for log, amount_wei, funded_from_balance, recipient in decoded]
        return items, total, total_count, recipient_totals

    def _require_contract(self) -> str:
        contract = self._settings.botchain_contract_address
        if not contract:
            raise RpcError("BOTCHAIN_CONTRACT_ADDRESS is not configured")
        return contract

    @staticmethod
    def _to_wei(amount: Decimal) -> int:
        wei = amount * WEI_PER_BOT
        if wei != wei.to_integral_value():
            raise RpcError("BOT amount exceeds 18 decimal places")
        return int(wei)

    @staticmethod
    def _from_wei(amount: int) -> Decimal:
        return Decimal(amount) / WEI_PER_BOT


def contract_error_message(error: object) -> str:
    """Translate known AgentGuard custom-error selectors into user-facing text."""
    serialized = str(error).lower()
    for selector, message in CONTRACT_ERRORS.items():
        if selector in serialized:
            return message
    if isinstance(error, dict):
        message = str(error.get("message", "RPC request rejected"))
    else:
        message = str(error or "RPC request rejected")
    return message[:240]
