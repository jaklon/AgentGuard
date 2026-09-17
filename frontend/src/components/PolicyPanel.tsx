import { useState, type FormEvent } from "react";
import { isAddress, parseEther, type Address } from "viem";
import { usePublicClient, useWriteContract } from "wagmi";

import { agentGuardAbi, contractAddress } from "../contract";
import type { PolicySnapshot } from "../types";

interface Props {
  policy?: PolicySnapshot;
  onSaved: () => Promise<unknown>;
}

export function PolicyPanel({ policy, onSaved }: Props) {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [perTx, setPerTx] = useState("0.02");
  const [daily, setDaily] = useState("0.10");
  const [recipient, setRecipient] = useState("");
  const [enforceAllowlist, setEnforceAllowlist] = useState(false);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function savePolicy(event: FormEvent) {
    event.preventDefault();
    if (!contractAddress || !publicClient) {
      setStatus("Contract address is not configured.");
      return;
    }
    if (enforceAllowlist && !isAddress(recipient)) {
      setStatus("Enter one complete allowlisted recipient address.");
      return;
    }

    setSaving(true);
    setStatus("Confirm the policy in MetaMask.");
    try {
      const policyHash = await writeContractAsync({
        address: contractAddress,
        abi: agentGuardAbi,
        functionName: "setPolicy",
        args: [
          parseEther(perTx),
          parseEther(daily),
          BigInt(Math.floor(Date.now() / 1000) + 30 * 86_400),
          enforceAllowlist,
        ],
      });
      await publicClient.waitForTransactionReceipt({ hash: policyHash });

      if (enforceAllowlist && isAddress(recipient)) {
        setStatus("Confirm the recipient allowlist in MetaMask.");
        const recipientHash = await writeContractAsync({
          address: contractAddress,
          abi: agentGuardAbi,
          functionName: "setRecipient",
          args: [recipient as Address, true],
        });
        await publicClient.waitForTransactionReceipt({ hash: recipientHash });
      }
      setStatus("Policy confirmed on BOT Chain.");
      await onSaved();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Policy update was cancelled.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-line bg-panel/70 p-6 shadow-glow">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Step 2</p>
          <h2 className="mt-2 text-xl font-bold">On-chain policy</h2>
        </div>
        <span
          className={
            "rounded-full px-3 py-1 text-xs font-bold " +
            (policy ? "bg-mint/10 text-mint" : "bg-white/5 text-fog")
          }
        >
          {policy ? "Loaded" : "Not found"}
        </span>
      </div>

      {policy && (
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="metric">
            <dt>Per transaction</dt>
            <dd>{policy.per_transaction_limit_bot} BOT</dd>
          </div>
          <div className="metric">
            <dt>Daily remaining</dt>
            <dd>
              {policy.daily_limit_bot} − {policy.spent_today_bot} BOT
            </dd>
          </div>
        </dl>
      )}

      <form className="mt-5 space-y-4" onSubmit={savePolicy}>
        <div className="grid grid-cols-2 gap-3">
          <label className="field">
            <span>Per transaction</span>
            <input value={perTx} onChange={(event) => setPerTx(event.target.value)} />
          </label>
          <label className="field">
            <span>Daily limit</span>
            <input value={daily} onChange={(event) => setDaily(event.target.value)} />
          </label>
        </div>
        <label className="flex items-center gap-3 text-sm text-fog">
          <input
            checked={enforceAllowlist}
            onChange={(event) => setEnforceAllowlist(event.target.checked)}
            type="checkbox"
          />
          Restrict payments to an allowlist
        </label>
        {enforceAllowlist && (
          <label className="field">
            <span>Allowed recipient</span>
            <input
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder="0x…"
            />
          </label>
        )}
        <button className="button-secondary w-full" disabled={saving || !contractAddress}>
          {saving ? "Waiting for wallet…" : "Save 30-day policy"}
        </button>
        {status && <p className="break-words text-xs leading-5 text-fog">{status}</p>}
      </form>
    </section>
  );
}
