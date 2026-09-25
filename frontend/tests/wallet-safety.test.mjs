import test from "node:test";
import assert from "node:assert/strict";
import { executePayment, setWalletPaused, ensureBotTestnet } from "../src/lib/botchain.ts";

const account = "0x1111111111111111111111111111111111111111";
const recipient = "0x2222222222222222222222222222222222222222";
const config = { chain_id: 968, contract_address: recipient };
const hash = "0x" + "11".repeat(32);

test("payment refuses a changed network before signing", async () => {
  const calls = [];
  const provider = { request: async ({ method }) => { calls.push(method); return "0x2a5"; } };
  await assert.rejects(executePayment(config, provider, account, recipient, "0.01", hash), /Switch your wallet/);
  assert.deepEqual(calls, ["eth_chainId"]);
});

test("policy change refuses a different selected account", async () => {
  const calls = [];
  const provider = { request: async ({ method }) => {
    calls.push(method);
    return method === "eth_chainId" ? "0x3c8" : [recipient];
  } };
  await assert.rejects(setWalletPaused(config, provider, true, account), /account changed/);
  assert.deepEqual(calls, ["eth_chainId", "eth_accounts"]);
});

test("inconsistent configuration cannot trigger a network switch", async () => {
  const provider = { request: async () => { throw new Error("must not call wallet"); } };
  await assert.rejects(ensureBotTestnet({ ...config, chain_id: 677 }, provider), /configuration mismatch/);
});

test("payment refuses an address without deployed bytecode", async () => {
  const provider = { request: async ({ method }) => {
    if (method === "eth_chainId") return "0x3c8";
    if (method === "eth_accounts") return [account];
    if (method === "eth_getCode") return "0x";
    throw new Error(`Unexpected signing request: ${method}`);
  } };
  await assert.rejects(executePayment(config, provider, account, recipient, "0.01", hash), /not deployed/);
});
