import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { isAddress, keccak256, parseEther, toBytes, type Address, type Hex } from "viem";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { z } from "zod";

import { evaluateGuard, fetchPolicy, simulatePayment } from "./api";
import { DecisionCard } from "./components/DecisionCard";
import { PolicyPanel } from "./components/PolicyPanel";
import {
  agentGuardAbi,
  botChainTestnet,
  contractAddress,
  explorerBaseUrl,
} from "./contract";
import type { GuardDecision, PolicySnapshot, Simulation } from "./types";

const formSchema = z
  .object({
    mode: z.enum(["natural", "manual"]),
    prompt: z.string(),
    recipient: z.string(),
    amount: z.string(),
    purpose: z.string().max(160),
  })
  .superRefine((value, context) => {
    if (value.mode === "natural" && value.prompt.trim().length < 8) {
      context.addIssue({ code: "custom", path: ["prompt"], message: "Add a complete instruction." });
    }
    if (value.mode === "manual") {
      if (!isAddress(value.recipient)) {
        context.addIssue({ code: "custom", path: ["recipient"], message: "Use a complete 0x address." });
      }
      if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(value.amount)) {
        context.addIssue({ code: "custom", path: ["amount"], message: "Use an exact decimal amount." });
      }
    }
  });

type FormValues = z.infer<typeof formSchema>;

function fallbackPolicy(wallet: string): PolicySnapshot {
  return {
    wallet,
    chain_id: botChainTestnet.id,
    per_transaction_limit_bot: "0.02",
    daily_limit_bot: "0.10",
    spent_today_bot: "0",
    expires_at: null,
    allowlist_enforced: false,
    allowed_recipients: [],
    paused: false,
  };
}

function Shield() {
  return (
    <svg viewBox="0 0 32 36" aria-hidden="true" className="h-9 w-8">
      <path
        d="M16 1.5 29 6v10.2c0 8.1-5.2 14.7-13 18.3C8.2 30.9 3 24.3 3 16.2V6l13-4.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <path d="m10 18 4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  );
}

export default function App() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, error: connectError, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { writeContractAsync, error: writeError, isPending: isSigning } = useWriteContract();
  const [decision, setDecision] = useState<GuardDecision>();
  const [simulation, setSimulation] = useState<Simulation>();
  const [intentHash, setIntentHash] = useState<Hex>();
  const [transactionHash, setTransactionHash] = useState<Hex>();
  const [formError, setFormError] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [warningAcknowledged, setWarningAcknowledged] = useState(false);

  const policyQuery = useQuery({
    queryKey: ["policy", address],
    queryFn: () => fetchPolicy(address!),
    enabled: Boolean(address && contractAddress),
    retry: 1,
  });

  const activePolicy = useMemo(
    () => (address ? policyQuery.data ?? fallbackPolicy(address) : undefined),
    [address, policyQuery.data],
  );

  const receipt = useWaitForTransactionReceipt({ hash: transactionHash });
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      mode: "natural",
      prompt:
        "Send 0.01 BOT to 0x2222222222222222222222222222222222222222 for the demo",
      recipient: "0x2222222222222222222222222222222222222222",
      amount: "0.01",
      purpose: "Hackathon demo",
    },
  });
  const mode = watch("mode");

  useEffect(() => {
    setDecision(undefined);
    setSimulation(undefined);
    setIntentHash(undefined);
    setWarningAcknowledged(false);
  }, [mode]);

  async function onEvaluate(values: FormValues) {
    if (!address || !activePolicy) {
      setFormError("Connect MetaMask before evaluating a payment.");
      return;
    }
    setEvaluating(true);
    setFormError("");
    setSimulation(undefined);
    setTransactionHash(undefined);
    setWarningAcknowledged(false);
    try {
      const result = await evaluateGuard(
        values.mode === "natural"
          ? { prompt: values.prompt.trim(), policy: activePolicy }
          : {
              manual_intent: {
                action: "payment",
                recipient: values.recipient,
                amount_bot: values.amount,
                chain_id: botChainTestnet.id,
                purpose: values.purpose,
              },
              policy: activePolicy,
            },
      );
      setDecision(result);
      if (!result.intent || result.decision === "BLOCK") return;

      const hash = keccak256(
        toBytes(
          [
            address.toLowerCase(),
            result.intent.recipient.toLowerCase(),
            result.intent.amount_bot,
            result.intent.purpose,
            result.evaluated_at,
          ].join("|"),
        ),
      );
      setIntentHash(hash);
      if (!contractAddress || !policyQuery.data) {
        setSimulation({
          allowed: false,
          reason: "Review-only mode: deploy the contract and create an on-chain policy.",
          estimated_gas: null,
        });
        return;
      }
      setSimulation(
        await simulatePayment({
          wallet: address,
          recipient: result.intent.recipient,
          amount_bot: result.intent.amount_bot,
          intent_hash: hash,
        }),
      );
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Evaluation failed.");
    } finally {
      setEvaluating(false);
    }
  }

  async function executePayment() {
    if (!decision?.intent || !intentHash || !contractAddress) return;
    if (chainId !== botChainTestnet.id) {
      switchChain({ chainId: botChainTestnet.id });
      return;
    }
    try {
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: agentGuardAbi,
        functionName: "executePayment",
        args: [decision.intent.recipient as Address, intentHash],
        value: parseEther(decision.intent.amount_bot),
      });
      setTransactionHash(hash);
    } catch {
      // wagmi exposes the sanitized wallet error below.
    }
  }

  const canPay =
    simulation?.allowed &&
    decision?.decision !== "BLOCK" &&
    (decision?.decision !== "WARN" || warningAcknowledged) &&
    Boolean(policyQuery.data);

  return (
    <div className="min-h-screen overflow-hidden bg-ink text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(114,230,177,.09),transparent_35%),radial-gradient(circle_at_85%_20%,rgba(184,243,74,.07),transparent_30%)]" />
      <header className="relative border-b border-line/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
          <a className="flex items-center gap-3 text-lime" href="/">
            <Shield />
            <span className="text-lg font-black tracking-tight text-white">AgentGuard</span>
          </a>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-line px-3 py-1 text-xs text-fog sm:inline">
              BOT Chain · Testnet {botChainTestnet.id}
            </span>
            {isConnected ? (
              <button className="button-secondary" onClick={() => disconnect()}>
                {address?.slice(0, 6)}…{address?.slice(-4)}
              </button>
            ) : (
              <button
                className="button-primary"
                disabled={isConnecting || !connectors[0]}
                onClick={() => connectors[0] && connect({ connector: connectors[0] })}
              >
                {isConnecting ? "Connecting…" : "Connect MetaMask"}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
        <section className="grid gap-10 lg:grid-cols-[1.25fr_.75fr] lg:items-end">
          <div>
            <p className="eyebrow">Human approval is the final authority</p>
            <h1 className="mt-5 max-w-3xl text-5xl font-black leading-[.98] tracking-[-0.04em] sm:text-6xl">
              Verify the intent.
              <span className="block text-lime">Then sign.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-fog">
              AgentGuard turns a payment request into a strict preview, checks your policy twice,
              and never touches your wallet keys.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line text-center">
            {[
              ["01", "Interpret"],
              ["02", "Guard"],
              ["03", "Approve"],
            ].map(([number, label]) => (
              <div className="bg-panel px-2 py-5" key={number}>
                <span className="font-mono text-xs text-lime">{number}</span>
                <span className="mt-1 block text-xs text-fog">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {isConnected && chainId !== botChainTestnet.id && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
            <p className="text-sm text-amber-100">MetaMask is connected to the wrong network.</p>
            <button
              className="button-secondary"
              disabled={isSwitching}
              onClick={() => switchChain({ chainId: botChainTestnet.id })}
            >
              Switch to BOT Chain
            </button>
          </div>
        )}

        <div className="mt-12 grid gap-6 lg:grid-cols-[.72fr_1.28fr]">
          <PolicyPanel policy={policyQuery.data} onSaved={() => policyQuery.refetch()} />

          <section className="rounded-3xl border border-line bg-panel/70 p-6 shadow-glow sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Step 3</p>
                <h2 className="mt-2 text-2xl font-bold">Describe the payment</h2>
              </div>
              <div className="flex rounded-xl bg-black/20 p-1 text-xs">
                <button
                  className={"mode-button " + (mode === "natural" ? "mode-active" : "")}
                  onClick={() => setValue("mode", "natural")}
                  type="button"
                >
                  Natural language
                </button>
                <button
                  className={"mode-button " + (mode === "manual" ? "mode-active" : "")}
                  onClick={() => setValue("mode", "manual")}
                  type="button"
                >
                  Manual fallback
                </button>
              </div>
            </div>

            <form className="mt-7" onSubmit={handleSubmit(onEvaluate)}>
              <input type="hidden" {...register("mode")} />
              {mode === "natural" ? (
                <label className="field">
                  <span>Payment instruction</span>
                  <textarea rows={4} {...register("prompt")} />
                  {errors.prompt && <em>{errors.prompt.message}</em>}
                </label>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="field sm:col-span-2">
                    <span>Recipient</span>
                    <input placeholder="0x…" {...register("recipient")} />
                    {errors.recipient && <em>{errors.recipient.message}</em>}
                  </label>
                  <label className="field">
                    <span>Amount · BOT</span>
                    <input inputMode="decimal" {...register("amount")} />
                    {errors.amount && <em>{errors.amount.message}</em>}
                  </label>
                  <label className="field">
                    <span>Purpose</span>
                    <input {...register("purpose")} />
                  </label>
                </div>
              )}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                <p className="text-xs leading-5 text-fog">
                  The AI may interpret; deterministic rules and the contract decide.
                </p>
                <button className="button-primary" disabled={evaluating || !address}>
                  {evaluating ? "Checking…" : "Run safety check"}
                </button>
              </div>
            </form>
            {(formError || connectError) && (
              <p className="mt-4 break-words rounded-xl bg-rose-400/10 p-3 text-sm text-rose-200">
                {formError || connectError?.message}
              </p>
            )}
          </section>
        </div>

        {decision && decision.intent && (
          <section className="mt-6 grid gap-6 lg:grid-cols-[.72fr_1.28fr]">
            <DecisionCard result={decision} />
            <div className="rounded-3xl border border-line bg-panel/70 p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Step 4</p>
                  <h2 className="mt-2 text-2xl font-bold">Transaction preview</h2>
                </div>
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-fog">
                  {simulation?.estimated_gas
                    ? "Gas " + simulation.estimated_gas.toLocaleString()
                    : "Simulation pending"}
                </span>
              </div>
              <dl className="mt-7 space-y-4 text-sm">
                <div className="preview-row">
                  <dt>Recipient</dt>
                  <dd className="font-mono">{decision.intent.recipient}</dd>
                </div>
                <div className="preview-row">
                  <dt>Amount</dt>
                  <dd>{decision.intent.amount_bot} BOT</dd>
                </div>
                <div className="preview-row">
                  <dt>Network</dt>
                  <dd>BOT Chain Testnet · {decision.intent.chain_id}</dd>
                </div>
                <div className="preview-row">
                  <dt>Contract</dt>
                  <dd className="font-mono">{contractAddress ?? "Not configured"}</dd>
                </div>
                <div className="preview-row">
                  <dt>Purpose</dt>
                  <dd>{decision.intent.purpose || "Not supplied"}</dd>
                </div>
              </dl>

              {simulation && (
                <p
                  className={
                    "mt-5 rounded-xl p-3 text-sm " +
                    (simulation.allowed
                      ? "bg-mint/10 text-mint"
                      : "bg-amber-400/10 text-amber-100")
                  }
                >
                  {simulation.reason}
                </p>
              )}

              {decision.decision === "WARN" && (
                <label className="mt-5 flex items-start gap-3 text-sm text-fog">
                  <input
                    checked={warningAcknowledged}
                    onChange={(event) => setWarningAcknowledged(event.target.checked)}
                    type="checkbox"
                  />
                  I reviewed the warning and still want MetaMask to show the final confirmation.
                </label>
              )}

              <button
                className="button-primary mt-6 w-full"
                disabled={!canPay || isSigning || receipt.isLoading}
                onClick={executePayment}
              >
                {isSigning
                  ? "Awaiting signature…"
                  : receipt.isLoading
                    ? "Transaction pending…"
                    : "Review and approve in MetaMask"}
              </button>
              {writeError && (
                <p className="mt-3 break-words text-sm text-rose-200">{writeError.message}</p>
              )}
              {receipt.isSuccess && transactionHash && (
                <a
                  className="mt-4 block rounded-xl border border-mint/30 bg-mint/10 p-4 text-center text-sm font-bold text-mint"
                  href={explorerBaseUrl + "/tx/" + transactionHash}
                  rel="noreferrer"
                  target="_blank"
                >
                  Confirmed · Open transaction in BOTScan ↗
                </a>
              )}
              {receipt.isError && (
                <p className="mt-3 text-sm text-rose-200">Transaction reverted or RPC timed out.</p>
              )}
            </div>
          </section>
        )}
      </main>
      <footer className="relative mx-auto flex max-w-7xl flex-wrap justify-between gap-3 border-t border-line px-5 py-8 text-xs text-fog lg:px-8">
        <span>AgentGuard · Build Week Hackathon Vol. 2</span>
        <span>No keys. No automatic signing. No hidden recipient.</span>
      </footer>
    </div>
  );
}
