"use client";

import { motion } from "framer-motion";
import { parseUnits } from "ethers";
import { useEffect, useRef, useState } from "react";
import { WalletConnectionButtons } from "../components/WalletConnectionButtons";
import { formatBotWei } from "../lib/amount";
import {
  chatWithAssistant,
  connectWallet,
  getPublicConfig,
  historyOf,
  policyOf,
  readinessOf,
  type AssistantMessage,
  type PaymentHistory,
  type Policy,
  type PublicConfig,
  type WalletConnectionMode,
  type WalletReadiness,
} from "../lib/botchain";
import { loadRecipients, type SavedRecipient } from "../lib/recipients";
import { Card, Icon, MBtn, Mono, Pill, Spinner, fadeUp } from "../shared";

const suggestions = [
  "How much BOT have I sent?",
  "Who is my largest recipient?",
  "Is it safe to pay 0.01 BOT?",
  "How does AgentGuard work?",
];

export default function AssistantView() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [wallet, setWallet] = useState("");
  const [history, setHistory] = useState<PaymentHistory | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [readiness, setReadiness] = useState<WalletReadiness | null>(null);
  const [recipients, setRecipients] = useState<SavedRecipient[]>([]);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [error, setError] = useState("");
  const [model, setModel] = useState("");
  const [usingFallback, setUsingFallback] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getPublicConfig().then(setConfig).catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [answering, messages]);

  async function connect(mode: WalletConnectionMode) {
    if (!config) return;
    setConnecting(true);
    setError("");
    try {
      const { account } = await connectWallet(config, mode);
      const [nextHistory, nextReadiness, nextPolicy] = await Promise.all([
        historyOf(account, false),
        readinessOf(account),
        policyOf(account).catch(() => null),
      ]);
      const addresses = Array.from(new Set([
        ...nextHistory.recipient_summaries.map((item) => item.recipient),
        ...(nextPolicy?.allowed_recipients || []),
      ]));
      setWallet(account);
      setHistory(nextHistory);
      setPolicy(nextPolicy);
      setReadiness(nextReadiness);
      setRecipients(loadRecipients(account, addresses));
      setMessages([{
        role: "assistant",
        text: `AgentGuard Assistant is ready. I loaded ${nextHistory.total_count} confirmed payments, the live wallet balance, and ${nextPolicy ? "the active Safety Policy" : "the current policy status"}. Ask a question—wallet answers stay grounded in live data.`,
      }]);
      setModel("");
      setUsingFallback(false);
    } catch (reason) {
      setError(message(reason, "Unable to connect the AI assistant."));
    } finally {
      setConnecting(false);
    }
  }

  async function ask(value = question) {
    const clean = value.trim();
    if (!clean || !wallet || !history || !readiness || answering) return;
    const conversation = messages.slice(-6);
    setMessages((current) => [...current, { role: "user", text: clean }]);
    setQuestion("");
    setAnswering(true);
    setError("");
    try {
      const response = await chatWithAssistant(
        wallet,
        clean,
        conversation,
        recipients.map((item) => ({ name: item.name, address: item.address })),
      );
      setMessages((current) => [...current, { role: "assistant", text: response.answer }]);
      setModel(response.model);
      setUsingFallback(false);
    } catch {
      const detail = "The AI assistant is temporarily unavailable.";
      let fallbackHistory = history;
      let fallbackPolicy = policy;
      let fallbackReadiness = readiness;
      try {
        [fallbackHistory, fallbackReadiness, fallbackPolicy] = await Promise.all([
          historyOf(wallet, false),
          readinessOf(wallet),
          policyOf(wallet).catch(() => null),
        ]);
        setHistory(fallbackHistory);
        setReadiness(fallbackReadiness);
        setPolicy(fallbackPolicy);
      } catch {
        setError(detail);
        setUsingFallback(true);
        setMessages((current) => [...current, {
          role: "assistant",
          text: "Latest wallet data could not be verified. The numbers in the side panel are an older snapshot and may have changed. Try again before making a payment decision.",
        }]);
        return;
      }
      setError(detail);
      setUsingFallback(true);
      setMessages((current) => [...current, {
        role: "assistant",
        text: groundedFallback(clean, fallbackHistory, fallbackPolicy, fallbackReadiness, recipients, detail),
      }]);
    } finally {
      setAnswering(false);
    }
  }

  const connected = Boolean(wallet && history && readiness);
  return <motion.div {...fadeUp}>
    <div className="mb-7">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-400">Private · grounded intelligence</p>
      <h1 className="mt-2 text-3xl font-semibold">AgentGuard AI Assistant</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Ask about AgentGuard, payment safety, your wallet, or live on-chain activity. Answers are grounded in verified BOT Chain Mainnet and contract data.</p>
    </div>

    {!connected ? <Card className="grid min-h-72 place-items-center p-8 text-center">
      <div>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-indigo-500/10 text-indigo-300"><Icon name="shield" size={24} /></div>
        <h2 className="mt-4 text-lg font-semibold">Connect your wallet for grounded answers</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">The assistant reads public BOT Chain Mainnet activity, your wallet balance, and your AgentGuard policy. It never receives your private key or seed phrase.</p>
        <WalletConnectionButtons onConnect={connect} busy={!config || connecting} busyLabel="Reading live data…" className="mx-auto mt-5 max-w-xs" />
        {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
      </div>
    </Card> : <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <Card className="flex min-h-[620px] flex-col p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.08] pb-4">
          <div><h2 className="font-semibold">Natural conversation</h2><p className="mt-1 text-xs text-slate-500"><Mono>{wallet.slice(0, 8)}…{wallet.slice(-4)}</Mono></p></div>
          <Pill status={usingFallback ? "WARN" : "ALLOW"} label={usingFallback ? "LIMITED RESPONSE" : model ? "LIVE DATA ANSWER" : "WALLET SNAPSHOT"} />
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto py-5" aria-live="polite">
          {messages.map((item, index) => <div key={`${item.role}-${index}`} className={`max-w-[88%] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-6 ${item.role === "user" ? "ml-auto bg-indigo-500/15 text-indigo-100" : "bg-white/[.05] text-slate-300"}`}>{item.text}</div>)}
          {answering && <div className="inline-flex items-center gap-2 rounded-xl bg-white/[.05] px-4 py-3 text-sm text-slate-400"><Spinner />Analyzing live data…</div>}
          <div ref={endRef} />
        </div>
        <div className="mb-3 flex flex-wrap gap-2">{suggestions.map((item) => <button key={item} onClick={() => void ask(item)} disabled={answering} className="rounded-full border border-white/[.1] px-3 py-1.5 text-[11px] text-slate-400 hover:border-indigo-400/40 hover:text-white disabled:opacity-40">{item}</button>)}</div>
        <form onSubmit={(event) => { event.preventDefault(); void ask(); }} className="flex gap-2">
          <input className="input min-w-0" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1_000} placeholder="Ask about AgentGuard, your wallet, or live on-chain activity…" />
          <MBtn type="submit" disabled={!question.trim() || answering}>{answering ? <Spinner /> : "Ask"}</MBtn>
        </form>
        {error && <p className="mt-3 text-xs text-amber-300">{error} Read the response for data availability.</p>}
      </Card>

      <div className="space-y-4">
        <Metric label="Total on-chain" value={`${history?.total_spent_bot ?? "—"} BOT`} />
        <Metric label="Daily spent" value={policy ? `${policy.spent_today_bot} BOT` : "Policy unavailable"} />
        <Metric label="Wallet balance (last loaded)" value={`${readiness ? trimAmount(readiness.balance_bot) : "—"} BOT`} />
        <Card className="p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500">Answer provenance</p><p className="mt-2 text-xs leading-5 text-slate-400">Private AI inference + BOT Chain Mainnet RPC + AgentGuard contract events{policy ? " + active Safety Policy" : ""}.</p></Card>
        <Card className="p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500">Safety boundary</p><p className="mt-2 text-xs leading-5 text-slate-400">AI can explain and analyze. It cannot sign, approve, or move funds. Never share a private key or seed phrase.</p></Card>
      </div>
    </div>}
  </motion.div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card className="p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></Card>;
}

function groundedFallback(question: string, history: PaymentHistory, policy: Policy | null, readiness: WalletReadiness, recipients: SavedRecipient[], detail: string): string {
  const normalized = question.toLocaleLowerCase();
  const names = Object.fromEntries(recipients.map((item) => [item.address.toLowerCase(), item.name]));
  const prefix = `${detail} Based on verified live data: `;
  if (/purpose|memo|what.*for/.test(normalized)) {
    return prefix + "payment purposes and memos are not stored in contract events, so I will not guess them. On-chain data only shows the recipient, amount, time, and transaction hash.";
  }
  if (/total|how much.*(sent|spent)/.test(normalized)) {
    return prefix + `${history.total_spent_bot} BOT was sent across ${history.total_count} confirmed transactions.`;
  }
  if (/largest|biggest|top recipient/.test(normalized)) {
    const largest = [...history.recipient_summaries].sort((left, right) => {
      const leftTotal = wei(left.total_amount_bot);
      const rightTotal = wei(right.total_amount_bot);
      return leftTotal === rightTotal ? 0 : leftTotal > rightTotal ? -1 : 1;
    })[0];
    if (!largest) return prefix + "there are no confirmed transactions yet.";
    const address = largest.recipient.toLowerCase();
    const label = names[address] || `${address.slice(0, 8)}…${address.slice(-4)}`;
    return prefix + `${label} received ${largest.total_amount_bot} BOT across ${largest.payment_count} transactions.`;
  }
  if (/remaining|daily limit/.test(normalized) && policy) {
    const remaining = maxZero(wei(policy.daily_limit_bot) - wei(policy.spent_today_bot));
    return prefix + `the remaining daily limit is ${formatBotWei(remaining)} BOT.`;
  }
  return prefix + `the wallet balance is ${trimAmount(readiness.balance_bot)} BOT with ${history.total_count} confirmed transactions. Try again for a fuller conversational answer.`;
}
function wei(value: string): bigint {
  try { return parseUnits(value, 18); } catch { return BigInt(0); }
}

function maxZero(value: bigint): bigint { return value > BigInt(0) ? value : BigInt(0); }

function trimAmount(value: string): string {
  const [whole, fraction = ""] = value.split(".");
  const trimmed = fraction.slice(0, 8).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

function message(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}
