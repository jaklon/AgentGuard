"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { TransactionActivity } from "../lib/activity";
import { connectWallet, getPublicConfig, historyOf, type PaymentHistory, type PaymentHistoryItem, type PublicConfig } from "../lib/botchain";
import { loadRecipients } from "../lib/recipients";
import { Card, CopyBtn, Icon, MBtn, Mono, Pill, Row, Spinner, fadeUp, short } from "../shared";

export default function HistoryView({ latest }: { latest: TransactionActivity | null }) {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [wallet, setWallet] = useState("");
  const [history, setHistory] = useState<PaymentHistory | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { getPublicConfig().then(setConfig).catch((reason: Error) => setError(reason.message)); }, []);

  async function refresh(account: string) {
    const next = await historyOf(account);
    setHistory(next);
    setNames(Object.fromEntries(loadRecipients(account, next.recipient_summaries.map((item) => item.recipient)).map((item) => [item.address.toLowerCase(), item.name])));
  }

  async function connect() {
    if (!config) return;
    setBusy(true); setError("");
    try {
      const account = await connectWallet(config);
      setWallet(account);
      await refresh(account);
    } catch (reason) { setError(message(reason)); }
    finally { setBusy(false); }
  }

  function exportCsv() {
    if (!history) return;
    const lines = [
      ["timestamp", "transaction_hash", "block", "recipient", "amount_bot", "source"],
      ...history.items.map((item) => [item.timestamp, item.transaction_hash, String(item.block_number), item.recipient, item.amount_bot, item.funded_from_balance ? "contract_balance" : "wallet"]),
    ];
    const csv = lines.map((line) => line.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `agentguard-${wallet.slice(0, 8)}-history.csv`; anchor.click();
    URL.revokeObjectURL(url);
  }

  return <motion.div {...fadeUp}>
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-400">On-chain activity</p><h1 className="mt-2 text-3xl font-semibold">Payment history</h1><p className="mt-2 text-sm text-slate-500">Receipts are reconstructed directly from AgentGuard contract events.</p></div>
      {history && <div className="flex gap-2"><MBtn variant="secondary" onClick={() => void refresh(wallet)} disabled={busy}>Refresh</MBtn><MBtn variant="secondary" onClick={exportCsv}>Export CSV</MBtn></div>}
    </div>
    {error && <p className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</p>}
    {!history ? <Card className="grid min-h-72 place-items-center p-8 text-center"><div><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-indigo-500/10 text-indigo-300"><Icon name="wallet" size={24} /></div><h2 className="mt-4 text-lg font-semibold">Connect your wallet to load receipts</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">No account login is required. History is read from public BOT Testnet events for the connected wallet.</p><MBtn onClick={connect} disabled={!config || busy} className="mt-5">{busy ? <><Spinner />Loading…</> : <><Icon name="wallet" />Connect MetaMask</>}</MBtn></div></Card> : <>
      <div className="mb-6 grid gap-3 sm:grid-cols-3"><Stat label="Confirmed payments" value={String(history.total_count)} /><Stat label="Total sent" value={`${history.total_spent_bot} BOT`} /><Stat label="Recipients" value={String(history.recipient_summaries.length)} /></div>
      {history.total_count > history.items.length && <p className="mb-4 text-xs text-slate-500">Showing the latest {history.items.length} receipts. Totals above include all {history.total_count} confirmed payments.</p>}
      {history.items.length === 0 ? <Card className="p-8 text-center"><h2 className="font-semibold">No AgentGuard payments yet</h2><p className="mt-2 text-sm text-slate-500">Payments will appear after the contract emits PaymentExecuted.</p></Card> : <div className="space-y-3">{history.items.map((item) => <ReceiptCard key={item.transaction_hash} item={item} name={names[item.recipient.toLowerCase()]} purpose={latest?.transaction_hash.toLowerCase() === item.transaction_hash.toLowerCase() ? latest.purpose : ""} />)}</div>}
    </>}
  </motion.div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <Card className="p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></Card>;
}

function ReceiptCard({ item, name, purpose }: { item: PaymentHistoryItem; name?: string; purpose: string }) {
  async function share() {
    const text = `AgentGuard receipt: ${item.amount_bot} BOT to ${name || short(item.recipient)} · ${item.transaction_hash}`;
    if (navigator.share) await navigator.share({ title: "AgentGuard receipt", text, url: item.explorer_url });
    else await navigator.clipboard?.writeText(`${text}\n${item.explorer_url}`);
  }
  return <Card className="p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="font-semibold">{name || "Verified recipient"}</h2><Pill status="ALLOW" label="CONFIRMED" /></div><p className="mt-1 text-xs text-slate-500">{new Date(item.timestamp).toLocaleString()}</p></div><p className="text-lg font-semibold text-emerald-300">{item.amount_bot} BOT</p></div>
    <div className="mt-3 grid gap-x-8 md:grid-cols-2"><Row label="Recipient" value={<span className="flex items-center gap-1"><Mono>{short(item.recipient)}</Mono><CopyBtn text={item.recipient} /></span>} /><Row label="Transaction" value={<span className="flex items-center gap-1"><Mono>{short(item.transaction_hash)}</Mono><CopyBtn text={item.transaction_hash} /></span>} /><Row label="Block" value={<Mono>{item.block_number.toLocaleString()}</Mono>} /><Row label="Purpose" value={purpose || "On-chain payment"} /></div>
    <div className="mt-4 flex flex-wrap gap-2"><a href={item.explorer_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold hover:border-white/40">Open BOTScan <Icon name="arrow" size={14} /></a><MBtn variant="ghost" onClick={() => void share()} className="px-3 py-2 text-xs">Share receipt</MBtn></div>
  </Card>;
}

function message(reason: unknown) { return reason instanceof Error ? reason.message : "Unable to load payment history"; }
