"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import type { EvaluationActivity, TransactionActivity } from "../lib/activity";
import { transactionOf } from "../lib/botchain";
import {
  Card,
  CopyBtn,
  Icon,
  MBtn,
  Mono,
  Pill,
  Row,
  Spinner,
  T,
  fadeUp,
  short,
  spring,
} from "../shared";

type LifecycleProps = {
  evaluation: EvaluationActivity | null;
  transaction: TransactionActivity | null;
  onTransaction: (activity: TransactionActivity) => void;
};

export default function LifecycleView({ evaluation, transaction, onTransaction }: LifecycleProps) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async (showProgress = true) => {
    if (!transaction || checking) return;
    if (showProgress) setChecking(true);
    setError("");
    try {
      const latest = await transactionOf(transaction.transaction_hash);
      if (
        latest.status !== transaction.status ||
        latest.block_number !== transaction.block_number ||
        latest.explorer_url !== transaction.explorer_url
      ) {
        onTransaction({
          ...transaction,
          status: latest.status,
          block_number: latest.block_number,
          explorer_url: latest.explorer_url,
        });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to refresh transaction status.");
    } finally {
      if (showProgress) setChecking(false);
    }
  }, [checking, onTransaction, transaction]);

  useEffect(() => {
    if (!transaction || transaction.status !== "pending") return;
    let active = true;
    let running = false;
    const poll = async () => {
      if (!active || running) return;
      running = true;
      try {
        const latest = await transactionOf(transaction.transaction_hash);
        if (active && (
          latest.status !== transaction.status ||
          latest.block_number !== transaction.block_number ||
          latest.explorer_url !== transaction.explorer_url
        )) {
          onTransaction({
            ...transaction,
            status: latest.status,
            block_number: latest.block_number,
            explorer_url: latest.explorer_url,
          });
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to refresh transaction status.");
      } finally {
        running = false;
      }
    };
    void poll();
    const id = window.setInterval(poll, 3500);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [onTransaction, transaction]);

  if (!transaction) return <EmptyLifecycle evaluation={evaluation} />;

  const terminal = transaction.status !== "pending";
  const confirmed = transaction.status === "confirmed";
  const included = transaction.block_number !== null || terminal;
  const statusTone = confirmed ? "ALLOW" : transaction.status === "reverted" ? "BLOCK" : "WARN";
  const statusLabel = transaction.status.toUpperCase();
  const steps = [
    { label: "Submitted", reached: true },
    { label: "Broadcast", reached: true },
    { label: "Included", reached: included },
    { label: confirmed ? "Confirmed" : transaction.status === "reverted" ? "Reverted" : "Finality", reached: terminal },
  ];

  return (
    <motion.div {...fadeUp}>
      <div className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-400">Live chain receipt</p>
        <h1 className="mt-2 text-3xl font-semibold">Transaction status</h1>
        <p className="mt-2 text-sm text-slate-500">Status is read from BOT Testnet and refreshes automatically while pending.</p>
      </div>
      {error && <div className="mb-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">{error}</div>}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card className="p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500">Network status</p>
              <div className="mt-2"><Pill status={statusTone} label={statusLabel} /></div>
            </div>
            <MBtn variant="secondary" onClick={() => void refresh()} disabled={checking} className="px-3 py-2 text-xs">
              {checking ? <Spinner /> : <span aria-hidden="true">↻</span>}
              Refresh
            </MBtn>
          </div>

          <div className="mt-8 flex justify-between">
            {steps.map((step, index) => (
              <div key={step.label} className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
                <motion.div
                  animate={{
                    scale: step.reached ? 1 : 0.78,
                    backgroundColor: step.reached
                      ? transaction.status === "reverted" && index === 3 ? T.block : confirmed && index === 3 ? T.allow : T.blue
                      : "#26344a",
                  }}
                  transition={spring}
                  className="grid h-8 w-8 place-items-center rounded-full text-xs text-[#080b0c]"
                >
                  {step.reached ? <Icon name={transaction.status === "reverted" && index === 3 ? "x" : "check"} size={14} /> : index + 1}
                </motion.div>
                <span className={`text-[10px] ${step.reached ? "text-slate-300" : "text-slate-600"}`}>{step.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-xl bg-[#0a101c] p-4">
            <Row
              label="Tx hash"
              value={<span className="flex items-center gap-1"><Mono>{short(transaction.transaction_hash)}</Mono><CopyBtn text={transaction.transaction_hash} /></span>}
            />
            <Row label="Block" value={transaction.block_number === null ? "Pending" : <Mono>{transaction.block_number.toLocaleString()}</Mono>} />
            <Row label="Network" value="BOT Testnet · 968" />
            <Row label="Submitted" value={formatTime(transaction.submitted_at)} />
          </div>
          {transaction.status === "pending" && <p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><Spinner /> Waiting for a BOT Testnet receipt. You may leave this page; tracking will continue when you return.</p>}
        </Card>

        <Card className="p-5 md:p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold">Payment receipt</h2>
            {evaluation && evaluation.wallet.toLowerCase() === transaction.wallet.toLowerCase() && <Pill status={evaluation.decision.decision} label={`GUARD ${evaluation.decision.decision}`} />}
          </div>
          <div className="mt-5">
            <Row label="Wallet" value={<Mono>{short(transaction.wallet)}</Mono>} />
            <Row label="Recipient" value={<span className="flex items-center gap-1"><Mono>{short(transaction.recipient)}</Mono><CopyBtn text={transaction.recipient} /></span>} />
            <Row label="Amount" value={<Mono>{transaction.amount_bot} BOT</Mono>} />
            <Row label="Purpose" value={transaction.purpose || "Not supplied"} />
          </div>
          <a
            href={transaction.explorer_url}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#d6c38c] px-4 py-3 text-sm font-semibold text-[#090c0d] transition-colors hover:bg-[#ead9a4]"
          >
            Open receipt on BOTScan
            <Icon name="arrow" size={16} />
          </a>
          <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">The explorer is the source of truth for final on-chain status.</p>
        </Card>
      </div>
    </motion.div>
  );
}

function EmptyLifecycle({ evaluation }: { evaluation: EvaluationActivity | null }) {
  return (
    <motion.div {...fadeUp}>
      <div className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-400">Live chain receipt</p>
        <h1 className="mt-2 text-3xl font-semibold">Transaction status</h1>
      </div>
      <Card className="grid min-h-72 place-items-center p-8 text-center">
        <div>
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-indigo-500/10 text-indigo-300"><Icon name="wallet" size={24} /></div>
          <h2 className="mt-4 text-lg font-semibold">No transaction submitted yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            {evaluation
              ? `The latest payment was evaluated as ${evaluation.decision.decision}, but no wallet transaction has been recorded. Return to Check Payment to approve it.`
              : "Evaluate a payment in Check Payment, then approve it in your wallet. Its real transaction hash and confirmation status will appear here."}
          </p>
          {evaluation && <div className="mt-4"><Pill status={evaluation.decision.decision} label={`LATEST CHECK · ${evaluation.decision.decision}`} /></div>}
        </div>
      </Card>
    </motion.div>
  );
}

function formatTime(value: string): string {
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? "Unknown" : time.toLocaleString();
}
