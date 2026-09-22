"use client";

import { useEffect, useState } from "react";
import { api, connectWallet, ensureBotTestnet, evaluatePayment, executePayment, getPublicConfig, newIntentHash, policyOf, simulatePayment, type GuardDecision, type Policy, type PublicConfig } from "../lib/botchain";
import { loadRecipients, type SavedRecipient } from "../lib/recipients";
import { Card, CopyBtn, Divider, Icon, MBtn, Mono, Pill, Row, Spinner, fadeUp } from "../shared";
import { motion } from "framer-motion";

type Receipt = { status: "pending" | "confirmed" | "reverted"; explorer_url: string };

export default function LiveDashboardView() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [wallet, setWallet] = useState("");
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [recipients, setRecipients] = useState<SavedRecipient[]>([]);
  const [prompt, setPrompt] = useState("");
  const [decision, setDecision] = useState<GuardDecision | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { getPublicConfig().then(setConfig).catch((e: Error) => setError(e.message)); }, []);
  useEffect(() => {
    if (!config || !window.ethereum) return;
    const accounts = (value: unknown) => { const account = (value as string[])[0] || ""; setWallet(account); setDecision(null); setReceipt(null); if (account) policyOf(account).then((nextPolicy) => { setPolicy(nextPolicy); setRecipients(loadRecipients(account, nextPolicy.allowed_recipients)); }).catch(() => { setPolicy(null); setRecipients([]); }); else { setPolicy(null); setRecipients([]); } };
    const chain = () => ensureBotTestnet(config).catch((e: Error) => setError(e.message));
    window.ethereum.on?.("accountsChanged", accounts); window.ethereum.on?.("chainChanged", chain);
    return () => { window.ethereum?.removeListener?.("accountsChanged", accounts); window.ethereum?.removeListener?.("chainChanged", chain); };
  }, [config]);
  async function connect() {
    if (!config) return; setBusy(true); setError("");
    try { const account = await connectWallet(config); const nextPolicy = await policyOf(account); setWallet(account); setPolicy(nextPolicy); setRecipients(loadRecipients(account, nextPolicy.allowed_recipients)); } catch (e) { setError(message(e)); setPolicy(null); setRecipients([]); } finally { setBusy(false); }
  }
  async function check() {
    if (!wallet) return setError("Connect a BOT Testnet wallet first."); setBusy(true); setError(""); setDecision(null); setReceipt(null);
    try { setDecision(await evaluatePayment(wallet, prompt, recipients)); } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function approve() {
    if (!config || !wallet || !decision?.intent) return; setBusy(true); setError("");
    try {
      await ensureBotTestnet(config); const intentHash = newIntentHash();
      const simulation = await simulatePayment(wallet, decision.intent.recipient, decision.intent.amount_bot, intentHash);
      if (!simulation.allowed) throw new Error(simulation.reason);
      const hash = await executePayment(config, decision.intent.recipient, decision.intent.amount_bot, intentHash);
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const latest = await api<Receipt>("/api/botchain/transaction/" + hash);
        setReceipt(latest);
        if (latest.status !== "pending") break;
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  const canProceed = (decision?.decision === "ALLOW" || decision?.decision === "WARN") && decision.intent;
  return <motion.div {...fadeUp} className="guard-home">
    <section className="guard-hero mb-8 pb-9"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-indigo-300">Live BOT Testnet · Chain 968</p><h1 className="guard-title mt-4 font-semibold leading-[.93] tracking-[-.055em]">Check before funds move.</h1><p className="mt-5 max-w-2xl text-base leading-7 text-slate-400">Policy comes from the contract. Only your wallet signs payments.</p></section>
    {error && <Notice error>{error}</Notice>}
    <div className="grid gap-7 lg:grid-cols-[310px_1fr]">
      <Card className="h-fit p-6"><p className="text-xs font-bold uppercase tracking-wider text-indigo-400">Wallet</p><h2 className="mt-2 text-lg font-semibold">{wallet ? short(wallet) : "Not connected"}</h2><MBtn className="mt-5 w-full" onClick={connect} disabled={!config || busy}>{busy ? <><Spinner />Connecting…</> : <><Icon name="wallet" />Connect MetaMask</>}</MBtn><Divider />{policy ? <><Row label="Per transaction" value={<Mono>{policy.per_transaction_limit_bot} BOT</Mono>} /><Row label="Daily limit" value={<Mono>{policy.daily_limit_bot} BOT</Mono>} /><Row label="Spent today" value={<Mono>{policy.spent_today_bot} BOT</Mono>} /><Row label="Allowlist" value={policy.allowlist_enforced ? policy.allowed_recipients.length + " recipients" : "Disabled"} /><Row label="Status" value={policy.paused ? "Paused" : "Active"} /></> : <p className="text-xs leading-5 text-slate-500">Create a policy in Safety Policy before paying.</p>}{config && <><Divider /><a className="text-xs text-indigo-300 underline" target="_blank" rel="noreferrer" href={config.explorer_url + "/address/" + config.contract_address}>View contract on BOTScan</a></>}</Card>
      <div><Card className="p-6 md:p-8"><p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Step 1 of 2</p><h2 className="mt-1 font-semibold">Describe the payment</h2><textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="input mt-5 min-h-40 resize-none text-base leading-7" placeholder="Example: Send 0.01 BOT to Alice for the testnet demo" />{recipients.length > 0 ? <div className="mt-4"><p className="text-xs text-slate-400">Choose a trusted recipient—no wallet address needed in your prompt.</p><div className="mt-2 flex flex-wrap gap-2">{recipients.map((recipient) => <button key={recipient.address} type="button" onClick={() => setPrompt(`Send 0.01 BOT to ${recipient.name}`)} className="rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1.5 text-xs font-medium text-indigo-200 hover:bg-indigo-400/20">{recipient.name}</button>)}</div></div> : <p className="mt-4 text-xs leading-5 text-slate-500">Name an allowlisted recipient in Safety Policy, then pay with a prompt such as “Send 0.01 BOT to Alice”.</p>}<MBtn onClick={check} disabled={!wallet || !prompt.trim() || busy} className="mt-5 w-full py-4">{busy ? <><Spinner />Checking policy…</> : <><Icon name="shield" />Check payment</>}</MBtn></Card>
      {decision && <Card className="mt-5 p-6"><Pill status={decision.decision} label={decision.decision} /><h3 className="mt-3 text-xl font-semibold">{decision.decision === "ALLOW" ? "Safe to proceed" : decision.decision === "WARN" ? "Review carefully before proceeding" : "Payment blocked"}</h3><p className="mt-2 text-sm text-slate-400">{decision.reason}</p>{decision.intent && <PaymentSummary intent={decision.intent} recipient={recipients.find((item) => item.address.toLowerCase() === decision.intent?.recipient.toLowerCase())} />}{decision.warnings.map((warning) => <Notice key={warning}>{warning}</Notice>)}{canProceed ? <MBtn onClick={approve} disabled={busy} variant={decision.decision === "WARN" ? "amber" : "approve"} className="mt-5 w-full py-3">{busy ? <><Spinner />Awaiting wallet confirmation…</> : <><Icon name="wallet" />{decision.decision === "WARN" ? "Review and approve in wallet" : "Approve in wallet"}</>}</MBtn> : <p className="mt-5 text-xs text-slate-500">Blocked payments never open a wallet request.</p>}{receipt && <Notice><a className="underline" target="_blank" rel="noreferrer" href={receipt.explorer_url}>Transaction {receipt.status}; open BOTScan</a></Notice>}</Card>}</div>
    </div>
  </motion.div>;
}
function Notice({ children, error = false }: { children: React.ReactNode; error?: boolean }) { return <div className={"mt-4 rounded-lg border px-3 py-2 text-xs " + (error ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : "border-amber-500/30 bg-amber-500/10 text-amber-200")}>{children}</div>; }
function PaymentSummary({ intent, recipient }: { intent: NonNullable<GuardDecision["intent"]>; recipient?: SavedRecipient }) { return <div className="mt-4"><Row label="Recipient" value={recipient?.name || "Verified recipient"} /><Row label="Wallet address" value={<span className="flex min-w-0 items-center gap-1"><Mono className="break-all text-xs">{intent.recipient}</Mono><CopyBtn text={intent.recipient} /></span>} /><Row label="Amount" value={<Mono>{intent.amount_bot} BOT</Mono>} /><Row label="Network" value="BOT Testnet · 968" /><Row label="Purpose" value={intent.purpose || "Not supplied"} /><p className="mt-4 text-xs leading-5 text-slate-500">Check the exact wallet address, amount, and network before approving in your wallet.</p></div>; }
function short(value: string) { return value.slice(0, 6) + "…" + value.slice(-4); }
function message(reason: unknown) { return reason instanceof Error ? reason.message : "Unexpected wallet or API error"; }
