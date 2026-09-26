"use client";

import { motion } from "framer-motion";
import type { EvaluationActivity } from "../lib/activity";
import { Card, CopyBtn, Icon, Mono, Pill, Row, ScoreRing, T, fadeUp, short, spring, stagger } from "../shared";

type CheckState = "pass" | "warn" | "block";

export default function RiskView({ evaluation }: { evaluation: EvaluationActivity | null }) {
  if (!evaluation) return <EmptyRisk />;
  const { decision, policy, wallet, recorded_at } = evaluation;
  const intent = decision.intent;
  const amount = Number(intent?.amount_bot || 0);
  const perTransaction = Number(policy?.per_transaction_limit_bot || 0);
  const dailyLimit = Number(policy?.daily_limit_bot || 0);
  const spentToday = Number(policy?.spent_today_bot || 0);
  const recipientAllowed = Boolean(intent && policy && (!policy.allowlist_enforced || policy.allowed_recipients.some((address) => address.toLowerCase() === intent.recipient.toLowerCase())));
  const policyExpired = Boolean(policy?.expires_at && new Date(policy.expires_at).getTime() <= new Date(recorded_at).getTime());
  const checks: Array<[string, CheckState]> = [
    ["Instruction parsed", intent ? "pass" : "block"],
    ["Correct network", intent?.chain_id === policy?.chain_id ? "pass" : "block"],
    ["Recipient allowlisted", recipientAllowed ? "pass" : "block"],
    ["Transaction amount", perTransaction > 0 && amount <= perTransaction ? (amount / perTransaction >= 0.8 ? "warn" : "pass") : "block"],
    ["Daily capacity", dailyLimit > 0 && spentToday + amount <= dailyLimit ? "pass" : "block"],
    ["Wallet policy active", policy && !policy.paused && !policyExpired ? "pass" : "block"],
  ];
  const factors: Array<[string, number]> = [
    ["Amount utilization", percent(amount, perTransaction)],
    ["Daily limit after payment", percent(spentToday + amount, dailyLimit)],
    ["Recipient risk", recipientAllowed ? 0 : 100],
    ["Policy conflict", policy && !policy.paused && !policyExpired ? 0 : 100],
    ["Extraction warnings", Math.min(100, decision.warnings.length * 35)],
  ];
  const riskLabel = decision.decision === "ALLOW" ? "Low risk" : decision.decision === "WARN" ? "Review required" : "Blocked risk";

  return <motion.div {...fadeUp}>
    <div className="mb-7"><p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-400">Live decision intelligence</p><h1 className="mt-2 text-3xl font-semibold">Risk breakdown</h1><p className="mt-2 text-sm text-slate-500">Latest evaluated payment for <Mono>{short(wallet)}</Mono></p></div>
    <div className="grid gap-6 lg:grid-cols-[272px_1fr]">
      <Card className="p-5"><div className="flex justify-center"><ScoreRing score={decision.risk_score} size={180} /></div><h2 className="mt-2 text-center text-sm font-semibold">{riskLabel}</h2><div className="mt-2 flex justify-center"><Pill status={decision.decision} /></div><p className="mt-3 text-center text-xs leading-5 text-slate-500">{decision.reason}</p><div className="my-5 h-px bg-white/[.07]" /><motion.div variants={stagger} initial="initial" animate="animate" className="space-y-3">{checks.map(([label, state]) => <motion.div variants={{ initial: { opacity: 0, scale: .95 }, animate: { opacity: 1, scale: 1, transition: spring } }} className="flex items-center justify-between text-xs" key={label}><span className="text-slate-400">{label}</span><span className={state === "pass" ? "text-emerald-400" : state === "warn" ? "text-amber-400" : "text-rose-400"}><Icon name={state === "pass" ? "check" : state === "warn" ? "warning" : "x"} size={15} /></span></motion.div>)}</motion.div></Card>
      <div className="space-y-6">
        <Card className="p-5 md:p-6"><div className="flex items-center justify-between gap-4"><h2 className="font-semibold">Policy utilization</h2><span className="text-[10px] uppercase tracking-wider text-slate-500">{decision.source} extraction</span></div><div className="mt-6 space-y-5">{factors.map(([label, value], index) => <div key={label}><div className="mb-2 flex justify-between text-xs"><span className="text-slate-400">{label}</span><Mono>{value}%</Mono></div><div className="h-1.5 rounded-full bg-white/5"><motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ ...spring, delay: index * .06 }} className="h-full rounded-full" style={{ background: value >= 80 ? T.block : value >= 50 ? T.warn : T.allow }} /></div></div>)}</div></Card>
        <Card className="p-5 md:p-6"><div className="flex items-center justify-between"><h2 className="font-semibold">Extracted intent</h2><span className="text-[10px] text-slate-500">{new Date(recorded_at).toLocaleString()}</span></div>{intent ? <div className="mt-4"><Row label="Action" value="Payment" /><Row label="Recipient" value={<span className="flex items-center gap-1"><Mono>{short(intent.recipient)}</Mono><CopyBtn text={intent.recipient} /></span>} /><Row label="Amount" value={<Mono>{intent.amount_bot} BOT</Mono>} /><Row label="Network" value={`BOT Chain Mainnet · ${intent.chain_id}`} /><Row label="Purpose" value={intent.purpose || "Not supplied"} /></div> : <p className="mt-4 text-sm text-rose-300">No valid payment intent was extracted.</p>}{decision.warnings.length > 0 && <div className="mt-4 space-y-2">{decision.warnings.map((warning) => <p key={warning} className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{warning}</p>)}</div>}</Card>
      </div>
    </div>
  </motion.div>;
}

function EmptyRisk() {
  return <motion.div {...fadeUp}><div className="mb-7"><p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-400">Live decision intelligence</p><h1 className="mt-2 text-3xl font-semibold">Risk breakdown</h1></div><Card className="grid min-h-72 place-items-center p-8 text-center"><div><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-indigo-500/10 text-indigo-300"><Icon name="shield" size={24} /></div><h2 className="mt-4 text-lg font-semibold">No payment evaluated yet</h2><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Open Check Payment and evaluate a prompt. The real score, policy checks, and extracted intent will appear here automatically.</p></div></Card></motion.div>;
}

function percent(value: number, limit: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(limit) || limit <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(value / limit * 100)));
}
