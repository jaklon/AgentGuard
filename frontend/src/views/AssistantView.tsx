"use client";

import { motion } from "framer-motion";
import { parseUnits } from "ethers";
import { useEffect, useState } from "react";
import { formatBotWei } from "../lib/amount";
import { connectWallet, getPublicConfig, historyOf, policyOf, readinessOf, type PaymentHistory, type Policy, type PublicConfig, type WalletConnectionMode, type WalletReadiness } from "../lib/botchain";
import { loadRecipients } from "../lib/recipients";
import { WalletConnectionButtons } from "../components/WalletConnectionButtons";
import { Card, Icon, MBtn, Mono, Pill, fadeUp } from "../shared";

type Message = { role: "user" | "assistant"; text: string };

const suggestions = [
  "Berapa total BOT yang saya kirim?",
  "Siapa recipient terbesar saya?",
  "Berapa sisa daily limit saya?",
  "Apakah aman membayar 0.01 BOT?",
];

export default function AssistantView() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [wallet, setWallet] = useState("");
  const [history, setHistory] = useState<PaymentHistory | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [readiness, setReadiness] = useState<WalletReadiness | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { getPublicConfig().then(setConfig).catch((reason: Error) => setError(reason.message)); }, []);

  async function connect(mode: WalletConnectionMode) {
    if (!config) return;
    setBusy(true); setError("");
    try {
      const { account } = await connectWallet(config, mode);
      const [nextHistory, nextPolicy, nextReadiness] = await Promise.all([historyOf(account), policyOf(account), readinessOf(account)]);
      setWallet(account); setHistory(nextHistory); setPolicy(nextPolicy); setReadiness(nextReadiness);
      setNames(Object.fromEntries(loadRecipients(account, nextHistory.recipient_summaries.map((item) => item.recipient)).map((item) => [item.address.toLowerCase(), item.name])));
      setMessages([{ role: "assistant", text: `Saya sudah membaca ringkasan ${nextHistory.total_count} receipt on-chain dan policy aktif untuk wallet ini. Silakan tanyakan aktivitas pengeluaran Anda.` }]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to connect the spending assistant"); }
    finally { setBusy(false); }
  }

  function ask(value = question) {
    const clean = value.trim();
    if (!clean || !history || !policy || !readiness) return;
    const answer = answerQuestion(clean, history, policy, readiness, names);
    setMessages((current) => [...current, { role: "user", text: clean }, { role: "assistant", text: answer }]);
    setQuestion("");
  }

  return <motion.div {...fadeUp}>
    <div className="mb-7"><p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-400">Private on-chain insights</p><h1 className="mt-2 text-3xl font-semibold">AI spending assistant</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Ask questions in Indonesian or English. Answers are calculated from live contract history and policy limits, not invented balances.</p></div>
    {!history || !policy || !readiness ? <Card className="grid min-h-72 place-items-center p-8 text-center"><div><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-indigo-500/10 text-indigo-300"><Icon name="shield" size={24} /></div><h2 className="mt-4 text-lg font-semibold">Connect your wallet for verified answers</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">The assistant reads only public on-chain activity and your active AgentGuard policy.</p><WalletConnectionButtons onConnect={connect} busy={!config || busy} busyLabel="Reading on-chain data…" className="mx-auto mt-5 max-w-xs" />{error && <p className="mt-3 text-xs text-rose-300">{error}</p>}</div></Card> : <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <Card className="flex min-h-[570px] flex-col p-5 md:p-6">
        <div className="flex items-center justify-between border-b border-white/[.08] pb-4"><div><h2 className="font-semibold">Spending conversation</h2><p className="mt-1 text-xs text-slate-500"><Mono>{wallet.slice(0, 8)}…{wallet.slice(-4)}</Mono></p></div><Pill status="ALLOW" label="LIVE DATA" /></div>
        <div className="flex-1 space-y-3 py-5">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`max-w-[86%] rounded-xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "ml-auto bg-indigo-500/15 text-indigo-100" : "bg-white/[.05] text-slate-300"}`}>{message.text}</div>)}</div>
        <div className="mb-3 flex flex-wrap gap-2">{suggestions.map((item) => <button key={item} onClick={() => ask(item)} className="rounded-full border border-white/[.1] px-3 py-1.5 text-[11px] text-slate-400 hover:border-indigo-400/40 hover:text-white">{item}</button>)}</div>
        <form onSubmit={(event) => { event.preventDefault(); ask(); }} className="flex gap-2"><input className="input min-w-0" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={240} placeholder="Tanyakan pengeluaran, limit, atau recipient…" /><MBtn type="submit" disabled={!question.trim()}>Ask</MBtn></form>
      </Card>
      <div className="space-y-4"><Metric label="Total on-chain" value={`${history.total_spent_bot} BOT`} /><Metric label="Daily spent" value={`${policy.spent_today_bot} BOT`} /><Metric label="Wallet balance" value={`${trimAmount(readiness.balance_bot)} BOT`} /><Card className="p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500">Answer provenance</p><p className="mt-2 text-xs leading-5 text-slate-400">Contract events, wallet balance, and active Safety Policy on BOT Testnet · 968.</p></Card></div>
    </div>}
  </motion.div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <Card className="p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></Card>; }

function answerQuestion(question: string, history: PaymentHistory, policy: Policy, readiness: WalletReadiness, names: Record<string, string>): string {
  const normalized = question.toLocaleLowerCase();
  const daily = wei(policy.daily_limit_bot);
  const spent = wei(policy.spent_today_bot);
  const remaining = daily > spent ? daily - spent : BigInt(0);
  if (/total|berapa.*(kirim|keluar|spend)|spent/.test(normalized)) return `Total pembayaran melalui AgentGuard adalah ${history.total_spent_bot} BOT dalam ${history.total_count} transaksi confirmed.`;
  if (/terbesar|largest|paling besar/.test(normalized)) {
    const largest = [...history.recipient_summaries].sort((left, right) => {
      const leftTotal = wei(left.total_amount_bot);
      const rightTotal = wei(right.total_amount_bot);
      return leftTotal === rightTotal ? 0 : leftTotal > rightTotal ? -1 : 1;
    })[0];
    if (!largest) return "Belum ada pembayaran confirmed untuk dibandingkan.";
    const recipient = largest.recipient.toLowerCase();
    return `Recipient terbesar adalah ${names[recipient] || `${recipient.slice(0, 8)}…${recipient.slice(-4)}`} dengan total ${largest.total_amount_bot} BOT dari ${largest.payment_count} transaksi.`;
  }
  if (/sisa|remaining|daily limit|limit harian/.test(normalized)) return `Sisa daily limit saat ini adalah ${formatBotWei(remaining)} BOT dari limit ${policy.daily_limit_bot} BOT. Penggunaan hari ini ${policy.spent_today_bot} BOT.`;
  if (/recipient|penerima|siapa/.test(normalized)) {
    const recipients = history.recipient_summaries.map((item) => item.recipient.toLowerCase());
    return recipients.length ? `Ada ${recipients.length} recipient confirmed: ${recipients.slice(0, 5).map((address) => names[address] || `${address.slice(0, 8)}…${address.slice(-4)}`).join(", ")}.` : "Belum ada recipient dalam riwayat pembayaran.";
  }
  if (/aman|safe/.test(normalized)) {
    const amountMatch = normalized.match(/(\d+(?:\.\d{1,18})?)\s*bot/);
    if (!amountMatch) return "Sebutkan jumlah BOT yang ingin diperiksa. Keamanan akhir juga bergantung pada recipient dan hasil simulasi contract.";
    const amount = wei(amountMatch[1]);
    const perTx = wei(policy.per_transaction_limit_bot);
    const balance = wei(readiness.balance_bot);
    const expired = Boolean(policy.expires_at && Date.parse(policy.expires_at) <= Date.now());
    const numericallyAllowed = amount > BigInt(0) && !policy.paused && !expired && amount <= perTx && amount <= remaining && amount < balance;
    return numericallyAllowed ? `${amountMatch[1]} BOT lolos pemeriksaan awal terhadap masa berlaku policy, per-transaction limit, daily remaining, dan saldo nilai transfer. Recipient dan biaya gas tetap harus lolos simulasi contract sebelum wallet dibuka.` : `${amountMatch[1]} BOT tidak lolos pemeriksaan awal berdasarkan status policy, limit, atau saldo. Per-transaction limit ${policy.per_transaction_limit_bot} BOT dan daily remaining ${formatBotWei(remaining)} BOT; simulasi tetap diperlukan untuk biaya gas.`;
  }
  return `Ringkasan: ${history.total_count} transaksi confirmed, total ${history.total_spent_bot} BOT, penggunaan harian ${policy.spent_today_bot}/${policy.daily_limit_bot} BOT, dan saldo ${trimAmount(readiness.balance_bot)} BOT. Tanyakan total, recipient terbesar, sisa limit, atau keamanan suatu jumlah.`;
}

function wei(value: string): bigint { try { return parseUnits(value, 18); } catch { return BigInt(0); } }
function trimAmount(value: string): string { const [whole, fraction = ""] = value.split("."); const trimmed = fraction.slice(0, 8).replace(/0+$/, ""); return trimmed ? `${whole}.${trimmed}` : whole; }
