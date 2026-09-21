from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import httpx
from agentguard_guard import PolicySnapshot
from eth_abi import decode, encode
from eth_utils import keccak

from .config import Settings

WEI_PER_BOT = Decimal(10**18)


class RpcError(RuntimeError):
    pass


class BotChainRpc:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def call(self, method: str, params: list[Any]) -> Any:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.post(
                    self._settings.botchain_testnet_rpc_url,
                    json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
                )
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise RpcError("BOT Chain RPC is unavailable") from exc
        if payload.get("error"):
            message = str(payload["error"].get("message", "RPC request rejected"))
            raise RpcError(message[:240])
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
