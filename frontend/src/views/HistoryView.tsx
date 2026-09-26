"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { TransactionActivity } from "../lib/activity";
import { connectWallet, getPublicConfig, historyOf, type PaymentHistory, type PaymentHistoryItem, type PublicConfig, type WalletConnectionMode, type WalletTransactionItem } from "../lib/botchain";
import { loadRecipients } from "../lib/recipients";
import { WalletConnectionButtons } from "../components/WalletConnectionButtons";
import { Card, CopyBtn, Icon, MBtn, Mono, Pill, Row, fadeUp, short } from "../shared";

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
    const addresses = Array.from(new Set([
      ...next.recipient_summaries.map((item) => item.recipient),
      ...next.wallet_activity.items.flatMap((item) => [item.from_address, item.to_address]).filter((value): value is string => Boolean(value)),
    ]));
    setHistory(next);
    setNames(Object.fromEntries(loadRecipients(account, addresses).map((item) => [item.address.toLowerCase(), item.name])));
  }

  async function connect(mode: WalletConnectionMode) {
    if (!config) return;
    setBusy(true); setError("");
    try {
      const { account } = await connectWallet(config, mode);
      setWallet(account);
      await refresh(account);
    } catch (reason) { setError(message(reason)); }
    finally { setBusy(false); }
  }

  async function reload() {
    if (!wallet) return;
    setBusy(true); setError("");
    try { await refresh(wallet); }
    catch (reason) { setError(message(reason)); }
    finally { setBusy(false); }
  }

  function exportCsv() {
    if (!history) return;
    const lines = [
      ["timestamp", "direction", "status", "transaction_hash", "block", "from", "to", "amount_bot", "fee_bot", "kind"],
      ...history.wallet_activity.items.map((item) => [item.timestamp, item.direction, item.status, item.transaction_hash, String(item.block_number), item.from_address || "", item.to_address || "", item.amount_bot, item.fee_bot, item.kind]),
    ];
    const csv = lines.map((line) => line.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `agentguard-${wallet.slice(0, 8)}-history.csv`; anchor.click();
    URL.revokeObjectURL(url);
  }

  return <motion.div {...fadeUp}>
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-400">BOT Chain Mainnet activity</p><h1 className="mt-2 text-3xl font-semibold">Wallet history</h1><p className="mt-2 text-sm text-slate-500">Incoming and outgoing wallet transactions are indexed from BOTScan; AgentGuard receipts are matched when available.</p></div>
      {history && <div className="flex gap-2"><MBtn variant="secondary" onClick={() => void reload()} disabled={busy}>Refresh</MBtn><MBtn variant="secondary" onClick={exportCsv} disabled={!history.wallet_activity.items.length}>Export CSV</MBtn></div>}
    </div>
    {error && <p className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</p>}
    {!history ? <Card className="grid min-h-72 place-items-center p-8 text-center"><div><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-indigo-500/10 text-indigo-300"><Icon name="wallet" size={24} /></div><h2 className="mt-4 text-lg font-semibold">Connect your wallet to load activity</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">No account login is required. AgentGuard reads public BOT Chain Mainnet transactions for the connected address.</p><WalletConnectionButtons onConnect={connect} busy={!config || busy} busyLabel="Loading…" className="mx-auto mt-5 max-w-xs" /></div></Card> : <>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Wallet transactions" value={String(history.wallet_activity.total_count)} /><Stat label="Received" value={`${history.wallet_activity.total_received_bot} BOT`} /><Stat label="Sent" value={`${history.wallet_activity.total_sent_bot} BOT`} /><Stat label="AgentGuard payments" value={String(history.total_count)} /></div>
      {!history.wallet_activity.available && <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">{history.wallet_activity.error || "BOTScan wallet history is temporarily unavailable. AgentGuard receipts are shown below."}</p>}
      {(history.wallet_activity.total_count > history.wallet_activity.items.length || !history.wallet_activity.complete) && <p className="mb-4 text-xs text-slate-500">Showing the latest {history.wallet_activity.items.length} indexed entries. Open BOTScan for the complete address history.</p>}
      {history.wallet_activity.available ? (history.wallet_activity.items.length === 0 ? <Card className="p-8 text-center"><h2 className="font-semibold">No wallet transactions found</h2><p className="mt-2 text-sm text-slate-500">Incoming and outgoing BOT Chain Mainnet activity will appear after BOTScan indexes it.</p></Card> : <div className="space-y-3">{history.wallet_activity.items.map((item) => {
        const receipt = history.items.find((candidate) => candidate.transaction_hash.toLowerCase() === item.transaction_hash.toLowerCase());
        return <ActivityCard key={item.activity_id} item={item} receipt={receipt} names={names} purpose={latest?.transaction_hash.toLowerCase() === item.transaction_hash.toLowerCase() ? latest.purpose : ""} />;
      })}</div>) : (history.items.length === 0 ? <Card className="p-8 text-center"><h2 className="font-semibold">No AgentGuard receipts found</h2></Card> : <div className="space-y-3">{history.items.map((item) => <ReceiptCard key={item.transaction_hash} item={item} name={names[item.recipient.toLowerCase()]} purpose={latest?.transaction_hash.toLowerCase() === item.transaction_hash.toLowerCase() ? latest.purpose : ""} />)}</div>)}
    </>}
  </motion.div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <Card className="p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></Card>;
}


function ActivityCard({ item, receipt, names, purpose }: { item: WalletTransactionItem; receipt?: PaymentHistoryItem; names: Record<string, string>; purpose: string }) {
  const partyAddress = receipt?.recipient || item.counterparty;
  const partyName = partyAddress ? names[partyAddress.toLowerCase()] : undefined;
  const directionLabel = item.direction === "incoming" ? "RECEIVED" : item.direction === "outgoing" ? "SENT" : "SELF";
  const title = item.direction === "incoming"
    ? `Received from ${partyName || (partyAddress ? short(partyAddress) : "unknown address")}`
    : item.direction === "outgoing"
      ? `Sent to ${partyName || (partyAddress ? short(partyAddress) : "contract creation")}`
      : "Self transaction";
  const sign = item.direction === "incoming" ? "+" : item.direction === "outgoing" ? "−" : "";
  const amountTone = item.status === "failed" ? "text-rose-300" : item.direction === "incoming" ? "text-emerald-300" : "text-slate-100";

  async function share() {
    const text = `${directionLabel}: ${item.amount_bot} BOT · ${item.transaction_hash}`;
    if (navigator.share) await navigator.share({ title: "BOT Chain Mainnet transaction", text, url: item.explorer_url });
    else await navigator.clipboard?.writeText(`${text}\n${item.explorer_url}`);
  }

  return <Card className="p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">{title}</h2>
          <Pill status={item.status === "failed" ? "BLOCK" : "ALLOW"} label={item.status.toUpperCase()} />
          <Pill status={item.direction === "outgoing" ? "WARN" : "INFO"} label={directionLabel} />
          {receipt && <Pill status="INFO" label="AGENTGUARD" />}
        </div>
        <p className="mt-1 text-xs text-slate-500">{new Date(item.timestamp).toLocaleString()}</p>
      </div>
      <p className={`text-lg font-semibold ${amountTone}`}>{sign}{item.amount_bot} BOT</p>
    </div>
    <div className="mt-3 grid gap-x-8 md:grid-cols-2">
      <Row label="From" value={<AddressValue address={item.from_address} />} />
      <Row label="To" value={<AddressValue address={receipt?.recipient || item.to_address} />} />
      <Row label="Transaction" value={<span className="flex items-center gap-1"><Mono>{short(item.transaction_hash)}</Mono><CopyBtn text={item.transaction_hash} /></span>} />
      <Row label="Block" value={<Mono>{item.block_number.toLocaleString()}</Mono>} />
      <Row label="Fee" value={`${item.fee_bot} BOT`} />
      <Row label="Type" value={purpose || (receipt ? "AgentGuard payment" : item.kind === "internal_transfer" ? "Internal transfer" : item.method)} />
    </div>
    <div className="mt-4 flex flex-wrap gap-2"><a href={item.explorer_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold hover:border-white/40">Open BOTScan <Icon name="arrow" size={14} /></a><MBtn variant="ghost" onClick={() => void share()} className="px-3 py-2 text-xs">Share transaction</MBtn></div>
  </Card>;
}

function AddressValue({ address }: { address: string | null }) {
  return address ? <span className="flex items-center gap-1"><Mono>{short(address)}</Mono><CopyBtn text={address} /></span> : <span>—</span>;
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
