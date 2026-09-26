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
        return await self._call_url(self._settings.botchain_rpc_url, method, params)

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
        if not isinstance(payload, dict):
            raise RpcError("BOT Chain RPC returned an invalid response")
        if payload.get("error"):
            raise RpcError(contract_error_message(payload["error"]))
        if "result" not in payload:
            raise RpcError("BOT Chain RPC response is missing a result")
        return payload["result"]


    async def _explorer_items(
        self,
        path: str,
        *,
        max_pages: int = 20,
    ) -> tuple[list[dict[str, Any]], int, bool]:
        """Read paginated address activity from the BOTScan Blockscout API."""
        url = f"{self._settings.botchain_explorer_url.rstrip('/')}{path}"
        items: list[dict[str, Any]] = []
        total_count = 0
        total_pages = 1
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                for page in range(1, max_pages + 1):
                    response = await client.get(url, params={"page": page})
                    response.raise_for_status()
                    payload = response.json()
                    page_items = payload.get("items")
                    if not isinstance(page_items, list):
                        raise ValueError("invalid explorer items")
                    items.extend(item for item in page_items if isinstance(item, dict))
                    total_count = int(payload.get("total_count", len(items)))
                    total_pages = max(0, int(payload.get("total_pages", 1)))
                    if page >= total_pages:
                        break
        except (httpx.HTTPError, TypeError, ValueError) as exc:
            raise RpcError("BOT Chain explorer is unavailable") from exc
        return items, total_count, total_pages <= max_pages

    async def chain_id(self) -> int:
        result = await self.call("eth_chainId", [])
        return int(result, 16)

    async def contract_code(self) -> str:
        return await self.call("eth_getCode", [self._require_contract(), "latest"])

    async def validate_contract(self) -> None:
        if await self.chain_id() != self._settings.botchain_chain_id:
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
            chain_id=self._settings.botchain_chain_id,
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


    async def wallet_history(
        self,
        wallet: str,
        *,
        limit: int = 100,
    ) -> dict[str, Any]:
        """Return indexed native BOT activity involving a wallet."""
        address = wallet.lower()
        normal_result, internal_result = await asyncio.gather(
            self._explorer_items(f"/api/v2/addresses/{wallet}/transactions"),
            self._explorer_items(f"/api/v2/addresses/{wallet}/internal-transactions"),
        )
        normal, normal_total, normal_complete = normal_result
        internal, internal_total, internal_complete = internal_result

        activity: list[dict[str, Any]] = []
        for item in normal:
            parsed = self._parse_wallet_activity(item, address, internal=False)
            if parsed:
                activity.append(parsed)
        for item in internal:
            parsed = self._parse_wallet_activity(item, address, internal=True)
            if parsed:
                activity.append(parsed)

        activity.sort(
            key=lambda item: (item["timestamp"], item["block_number"], item["activity_id"]),
            reverse=True,
        )
        received = Decimal(0)
        sent = Decimal(0)
        incoming_count = 0
        outgoing_count = 0
        for item in activity:
            if item["direction"] == "incoming":
                incoming_count += 1
                if item["status"] == "confirmed":
                    received += item["amount_bot"]
            elif item["direction"] == "outgoing":
                outgoing_count += 1
                if item["status"] == "confirmed":
                    sent += item["amount_bot"]

        return {
            "available": True,
            "complete": normal_complete and internal_complete,
            "total_count": normal_total + internal_total,
            "incoming_count": incoming_count,
            "outgoing_count": outgoing_count,
            "total_received_bot": received,
            "total_sent_bot": sent,
            "items": activity[:limit],
        }

    def _parse_wallet_activity(
        self,
        item: dict[str, Any],
        wallet: str,
        *,
        internal: bool,
    ) -> dict[str, Any] | None:
        try:
            transaction_hash = str(item.get("transaction_hash") if internal else item.get("hash"))
            if not transaction_hash.startswith("0x") or len(transaction_hash) != 66:
                return None
            from_address = self._explorer_address(item.get("from"))
            to_address = self._explorer_address(item.get("to"))
            if from_address and from_address.lower() == wallet and to_address and to_address.lower() == wallet:
                direction = "self"
                counterparty = wallet
            elif to_address and to_address.lower() == wallet:
                direction = "incoming"
                counterparty = from_address
            elif from_address and from_address.lower() == wallet:
                direction = "outgoing"
                counterparty = to_address
            else:
                return None

            timestamp = datetime.fromisoformat(str(item["timestamp"]).replace("Z", "+00:00"))
            if timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=UTC)
            status_ok = bool(item.get("success", True)) if internal else (
                item.get("status") == "ok" or item.get("result") == "success"
            )
            fee = item.get("fee") or {}
            fee_wei = int(fee.get("value", 0)) if isinstance(fee, dict) else 0
            trace_identity = item.get("index") or item.get("trace_address") or len(str(item))
            return {
                "activity_id": f"{transaction_hash}:{'internal' if internal else 'transaction'}:{trace_identity}",
                "transaction_hash": transaction_hash,
                "block_number": int(item.get("block_number", item.get("block", 0))),
                "timestamp": timestamp,
                "from_address": from_address,
                "to_address": to_address,
                "counterparty": counterparty,
                "direction": direction,
                "amount_bot": self._from_wei(int(item.get("value", 0))),
                "fee_bot": self._from_wei(fee_wei),
                "status": "confirmed" if status_ok else "failed",
                "method": str(item.get("method") or item.get("type") or "Transfer"),
                "kind": "internal_transfer" if internal else "transaction",
            }
        except (KeyError, TypeError, ValueError):
            return None

    @staticmethod
    def _explorer_address(value: object) -> str | None:
        if isinstance(value, dict):
            value = value.get("hash")
        if isinstance(value, str) and value.startswith("0x") and len(value) == 42:
            return value
        return None

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
