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
  "Untuk apa saja pengeluaran saya?",
  "Siapa recipient terbesar saya?",
  "Apakah aman membayar 0.01 BOT?",
  "Jelaskan cara kerja AgentGuard",
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
        text: `Qwen siap. Saya sudah memuat ${nextHistory.total_count} receipt terkonfirmasi, saldo wallet, dan ${nextPolicy ? "Safety Policy aktif" : "status policy"}. Tanyakan apa saja—jawaban tentang wallet akan selalu mengacu pada data live.`,
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
    } catch (reason) {
      const detail = message(reason, "Qwen is temporarily unavailable.");
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
          text: "Data terbaru belum dapat diverifikasi. Angka di panel adalah snapshot sebelumnya dan mungkin sudah berubah. Coba lagi sebelum mengambil keputusan pembayaran.",
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
      <p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-400">Qwen · grounded intelligence</p>
      <h1 className="mt-2 text-3xl font-semibold">AgentGuard AI Assistant</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Tanyakan apa saja dalam Bahasa Indonesia atau English. Qwen dapat membahas topik umum, dengan fokus utama pada AgentGuard, wallet, keamanan pembayaran, dan data on-chain live.</p>
    </div>

    {!connected ? <Card className="grid min-h-72 place-items-center p-8 text-center">
      <div>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-indigo-500/10 text-indigo-300"><Icon name="shield" size={24} /></div>
        <h2 className="mt-4 text-lg font-semibold">Connect your wallet for grounded answers</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Qwen reads public BOT Testnet activity, wallet balance, and your AgentGuard policy. It never receives your private key or seed phrase.</p>
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
          {answering && <div className="inline-flex items-center gap-2 rounded-xl bg-white/[.05] px-4 py-3 text-sm text-slate-400"><Spinner />Qwen sedang membaca data live…</div>}
          <div ref={endRef} />
        </div>
        <div className="mb-3 flex flex-wrap gap-2">{suggestions.map((item) => <button key={item} onClick={() => void ask(item)} disabled={answering} className="rounded-full border border-white/[.1] px-3 py-1.5 text-[11px] text-slate-400 hover:border-indigo-400/40 hover:text-white disabled:opacity-40">{item}</button>)}</div>
        <form onSubmit={(event) => { event.preventDefault(); void ask(); }} className="flex gap-2">
          <input className="input min-w-0" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1_000} placeholder="Tanyakan apa saja tentang AgentGuard, wallet, atau topik lain…" />
          <MBtn type="submit" disabled={!question.trim() || answering}>{answering ? <Spinner /> : "Ask"}</MBtn>
        </form>
        {error && <p className="mt-3 text-xs text-amber-300">{error} Read the response for data availability.</p>}
      </Card>

      <div className="space-y-4">
        <Metric label="Total on-chain" value={`${history?.total_spent_bot ?? "—"} BOT`} />
        <Metric label="Daily spent" value={policy ? `${policy.spent_today_bot} BOT` : "Policy unavailable"} />
        <Metric label="Wallet balance (last loaded)" value={`${readiness ? trimAmount(readiness.balance_bot) : "—"} BOT`} />
        <Card className="p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500">Answer provenance</p><p className="mt-2 text-xs leading-5 text-slate-400">Balance-only answers use live BOT Testnet RPC. Analysis uses private Qwen inference with available wallet and contract data. Check each answer for its data sources.</p>{model && <p className="mt-2 break-words text-[10px] text-slate-600">{model}</p>}</Card>
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
  const indonesian = /\b(apa|berapa|siapa|saya|aman|untuk|jelaskan|bagaimana)\b/.test(normalized);
  const names = Object.fromEntries(recipients.map((item) => [item.address.toLowerCase(), item.name]));
  const prefix = indonesian ? `Qwen sedang tidak tersedia (${detail}). Berdasarkan data live: ` : `Qwen is temporarily unavailable (${detail}). Based on live data: `;
  if (/untuk apa|purpose|memo|what.*for/.test(normalized)) {
    return prefix + (indonesian
      ? "tujuan atau memo pembayaran tidak disimpan di event contract, jadi saya tidak akan menebaknya. Data on-chain hanya menunjukkan recipient, jumlah, waktu, dan hash transaksi."
      : "payment purposes and memos are not stored in contract events, so I will not guess them. On-chain data only shows the recipient, amount, time, and transaction hash.");
  }
  if (/total|berapa.*(kirim|keluar)|how much.*(sent|spent)/.test(normalized)) {
    return prefix + (indonesian
      ? `${history.total_spent_bot} BOT telah dikirim dalam ${history.total_count} transaksi terkonfirmasi.`
      : `${history.total_spent_bot} BOT was sent across ${history.total_count} confirmed transactions.`);
  }
  if (/terbesar|largest|biggest|top recipient/.test(normalized)) {
    const largest = [...history.recipient_summaries].sort((left, right) => {
      const leftTotal = wei(left.total_amount_bot);
      const rightTotal = wei(right.total_amount_bot);
      return leftTotal === rightTotal ? 0 : leftTotal > rightTotal ? -1 : 1;
    })[0];
    if (!largest) return prefix + (indonesian ? "belum ada transaksi terkonfirmasi." : "there are no confirmed transactions yet.");
    const address = largest.recipient.toLowerCase();
    const label = names[address] || `${address.slice(0, 8)}…${address.slice(-4)}`;
    return prefix + (indonesian ? `${label} menerima ${largest.total_amount_bot} BOT dalam ${largest.payment_count} transaksi.` : `${label} received ${largest.total_amount_bot} BOT across ${largest.payment_count} transactions.`);
  }
  if (/sisa|remaining|daily limit|limit harian/.test(normalized) && policy) {
    const remaining = maxZero(wei(policy.daily_limit_bot) - wei(policy.spent_today_bot));
    return prefix + (indonesian ? `sisa daily limit adalah ${formatBotWei(remaining)} BOT.` : `the remaining daily limit is ${formatBotWei(remaining)} BOT.`);
  }
  return prefix + (indonesian
    ? `wallet memiliki saldo ${trimAmount(readiness.balance_bot)} BOT dan ${history.total_count} transaksi terkonfirmasi. Coba lagi untuk jawaban percakapan yang lebih lengkap.`
    : `the wallet balance is ${trimAmount(readiness.balance_bot)} BOT with ${history.total_count} confirmed transactions. Try again for a fuller conversational answer.`);
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
