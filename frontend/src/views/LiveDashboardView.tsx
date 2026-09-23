"use client";

import { motion } from "framer-motion";
import { isAddress } from "ethers";
import { useEffect, useRef, useState } from "react";
import type { EvaluationActivity, TransactionActivity } from "../lib/activity";
import { isValidBotAmount, sameBotAmount } from "../lib/amount";
import {
  connectWallet,
  ensureBotTestnet,
  evaluatePayment,
  executePayment,
  getPublicConfig,
  historyOf,
  newIntentHash,
  policyOf,
  readinessOf,
  simulatePayment,
  transactionOf,
  type Eip1193Provider,
  type GuardDecision,
  type PaymentHistory,
  type Policy,
  type PublicConfig,
  type SimulationPreview,
  type TransactionStatus,
  type WalletConnectionMode,
  type WalletReadiness,
} from "../lib/botchain";
import { WalletConnectionButtons } from "../components/WalletConnectionButtons";
import { enableNotifications, notificationsEnabled, notifyTransaction } from "../lib/notifications";
import { loadRecipients, type SavedRecipient } from "../lib/recipients";
import { loadTemplates, removeTemplate, saveTemplate, type PaymentTemplate } from "../lib/templates";
import { Card, CopyBtn, Divider, Icon, MBtn, Mono, Pill, Row, Spinner, fadeUp, short } from "../shared";

type BusyState = "" | "connect" | "check" | "approve";

export default function LiveDashboardView({
  onEvaluation,
  onTransaction,
}: {
  onEvaluation: (activity: EvaluationActivity) => void;
  onTransaction: (activity: TransactionActivity) => void;
}) {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [wallet, setWallet] = useState("");
  const [walletProvider, setWalletProvider] = useState<Eip1193Provider | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [readiness, setReadiness] = useState<WalletReadiness | null>(null);
  const [history, setHistory] = useState<PaymentHistory | null>(null);
  const [recipients, setRecipients] = useState<SavedRecipient[]>([]);
  const [templates, setTemplates] = useState<PaymentTemplate[]>([]);
  const [prompt, setPrompt] = useState("");
  const [requestName, setRequestName] = useState("");
  const [decision, setDecision] = useState<GuardDecision | null>(null);
  const [preview, setPreview] = useState<SimulationPreview | null>(null);
  const [intentHash, setIntentHash] = useState("");
  const [receipt, setReceipt] = useState<TransactionStatus | null>(null);
  const [busy, setBusy] = useState<BusyState>("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [notifications, setNotifications] = useState(false);
  const notified = useRef(new Set<string>());
  const selectedWallet = useRef("");
  const walletRefreshVersion = useRef(0);
  const evaluationVersion = useRef(0);

  useEffect(() => {
    getPublicConfig().then(setConfig).catch((reason: Error) => setError(reason.message));
    setNotifications(notificationsEnabled());
    const params = new URLSearchParams(window.location.search);
    const recipient = params.get("recipient") || "";
    const amount = params.get("amount") || "";
    const purpose = (params.get("purpose") || "").slice(0, 160);
    if (isAddress(recipient) && isValidBotAmount(amount)) {
      setPrompt(`Send ${amount} BOT to ${recipient}${purpose ? ` for ${purpose}` : ""}`);
      setRequestName((params.get("name") || "Shared payment request").slice(0, 64));
    }
  }, []);

  useEffect(() => {
    if (!config || !walletProvider) return;
    const accounts = (value: unknown) => {
      const account = (value as string[])[0] || "";
      selectedWallet.current = account;
      walletRefreshVersion.current += 1;
      setWallet(account); invalidatePaymentState();
      clearWalletData();
      if (account) void refreshWallet(account).catch((reason: Error) => {
        setError(reason.message);
      });
    };
    const chain = () => ensureBotTestnet(config, walletProvider).catch((reason: Error) => setError(reason.message));
    walletProvider.on?.("accountsChanged", accounts);
    walletProvider.on?.("chainChanged", chain);
    return () => {
      walletProvider.removeListener?.("accountsChanged", accounts);
      walletProvider.removeListener?.("chainChanged", chain);
    };
  }, [config, walletProvider]);

  useEffect(() => {
    if (!receipt || receipt.status === "pending") return;
    const key = `${receipt.transaction_hash}:${receipt.status}`;
    if (notified.current.has(key)) return;
    notified.current.add(key);
    notifyTransaction(receipt.status, receipt.transaction_hash);
  }, [receipt]);

  function clearWalletData() {
    setPolicy(null); setReadiness(null); setHistory(null); setRecipients([]); setTemplates([]);
  }

  function invalidatePaymentState() {
    evaluationVersion.current += 1;
    setDecision(null); setPreview(null); setIntentHash(""); setReceipt(null); setSaved("");
  }

  async function refreshWallet(account: string) {
    if (selectedWallet.current.toLowerCase() !== account.toLowerCase()) return;
    const version = ++walletRefreshVersion.current;
    const [nextPolicy, nextReadiness, nextHistory] = await Promise.all([
      policyOf(account),
      readinessOf(account),
      historyOf(account),
    ]);
    if (version !== walletRefreshVersion.current || selectedWallet.current.toLowerCase() !== account.toLowerCase()) return;
    setPolicy(nextPolicy);
    setReadiness(nextReadiness);
    setHistory(nextHistory);
    setRecipients(loadRecipients(account, nextPolicy.allowed_recipients));
    setTemplates(loadTemplates(account));
  }

  async function connect(mode: WalletConnectionMode) {
    if (!config) return;
    setBusy("connect"); setError("");
    try {
      const connection = await connectWallet(config, mode);
      selectedWallet.current = connection.account;
      setWallet(connection.account);
      setWalletProvider(connection.provider);
      invalidatePaymentState();
      clearWalletData();
      await refreshWallet(connection.account);
    } catch (reason) {
      setError(message(reason)); clearWalletData();
    } finally {
      setBusy("");
    }
  }

  async function check() {
    if (!wallet) return setError("Connect a BOT Testnet wallet first.");
    const account = wallet;
    const paymentPrompt = prompt;
    const version = ++evaluationVersion.current;
    setBusy("check"); setError(""); setSaved(""); setDecision(null); setPreview(null); setReceipt(null);
    try {
      const nextDecision = await evaluatePayment(account, paymentPrompt, recipients);
      if (version !== evaluationVersion.current || selectedWallet.current.toLowerCase() !== account.toLowerCase()) return;
      const nextHash = newIntentHash();
      setDecision(nextDecision); setIntentHash(nextHash);
      onEvaluation({ wallet: account, decision: nextDecision, policy, recorded_at: nextDecision.evaluated_at || new Date().toISOString() });
      if ((nextDecision.decision === "ALLOW" || nextDecision.decision === "WARN") && nextDecision.intent) {
        const nextPreview = await simulatePayment(account, nextDecision.intent.recipient, nextDecision.intent.amount_bot, nextHash);
        if (version === evaluationVersion.current && selectedWallet.current.toLowerCase() === account.toLowerCase()) setPreview(nextPreview);
      }
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy("");
    }
  }

  async function approve() {
    if (!config || !walletProvider || !wallet || !decision?.intent || !preview?.allowed || !intentHash) return;
    const account = wallet;
    const version = evaluationVersion.current;
    setBusy("approve"); setError("");
    try {
      await ensureBotTestnet(config, walletProvider);
      if (version !== evaluationVersion.current || selectedWallet.current.toLowerCase() !== account.toLowerCase()) throw new Error("Wallet or payment details changed. Run the safety check again.");
      const simulation = await simulatePayment(account, decision.intent.recipient, decision.intent.amount_bot, intentHash);
      setPreview(simulation);
      if (!simulation.allowed) throw new Error(simulation.reason);
      if (version !== evaluationVersion.current || selectedWallet.current.toLowerCase() !== account.toLowerCase()) throw new Error("Wallet or payment details changed. Run the safety check again.");
      const hash = await executePayment(config, walletProvider, account, decision.intent.recipient, decision.intent.amount_bot, intentHash);
      const transaction: TransactionActivity = {
        wallet: account,
        transaction_hash: hash,
        status: "pending",
        explorer_url: config.explorer_url + "/tx/" + hash,
        block_number: null,
        recipient: decision.intent.recipient,
        amount_bot: decision.intent.amount_bot,
        purpose: decision.intent.purpose,
        submitted_at: new Date().toISOString(),
      };
      if (selectedWallet.current.toLowerCase() === account.toLowerCase()) setReceipt({ transaction_hash: hash, status: "pending", block_number: null, explorer_url: transaction.explorer_url });
      onTransaction(transaction);
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const latest = await transactionOf(hash);
        if (selectedWallet.current.toLowerCase() === account.toLowerCase()) setReceipt(latest);
        onTransaction({ ...transaction, status: latest.status, explorer_url: latest.explorer_url, block_number: latest.block_number });
        if (latest.status !== "pending") {
          await refreshWallet(account).catch(() => undefined);
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy("");
    }
  }

  function applyTemplate(template: PaymentTemplate) {
    const trustedName = recipients.find((item) => item.address.toLowerCase() === template.recipient.toLowerCase())?.name;
    const target = trustedName || template.recipient;
    setPrompt(`Send ${template.amount_bot} BOT to ${target}${template.purpose ? ` for ${template.purpose}` : ""}`);
    invalidatePaymentState();
  }

  function saveCurrentTemplate() {
    if (!wallet || !decision?.intent) return;
    const recipientName = recipients.find((item) => item.address.toLowerCase() === decision.intent?.recipient.toLowerCase())?.name || "";
    const next = saveTemplate(wallet, {
      name: decision.intent.purpose || `Pay ${recipientName || short(decision.intent.recipient)}`,
      recipient: decision.intent.recipient,
      recipient_name: recipientName,
      amount_bot: decision.intent.amount_bot,
      purpose: decision.intent.purpose,
    });
    setTemplates(next); setSaved("Template saved");
  }

  async function turnOnNotifications() {
    const enabled = await enableNotifications();
    setNotifications(enabled);
    if (!enabled) setError("Browser notifications were not enabled. You can allow them in site settings.");
  }

  const duplicateCount = decision?.intent ? history?.items.filter((item) =>
    item.recipient.toLowerCase() === decision.intent?.recipient.toLowerCase() &&
    sameBotAmount(item.amount_bot, decision.intent?.amount_bot || "")
  ).length || 0 : 0;
  const previousRecipientPayments = decision?.intent ? history?.recipient_summaries.find((item) =>
    item.recipient.toLowerCase() === decision.intent?.recipient.toLowerCase()
  )?.payment_count || 0 : 0;
  const similarRecipient = decision?.intent ? recipients.find((item) => {
    const candidate = item.address.toLowerCase();
    const target = decision.intent!.recipient.toLowerCase();
    return candidate !== target && (candidate.slice(0, 10) === target.slice(0, 10) || candidate.slice(-6) === target.slice(-6));
  }) : undefined;
  const canProceed = Boolean(
    (decision?.decision === "ALLOW" || decision?.decision === "WARN") &&
    decision.intent && preview?.allowed,
  );

  return <motion.div {...fadeUp} className="guard-home">
    <section className="guard-hero mb-8 pb-9">
      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-indigo-300">Live BOT Testnet · Chain 968</p>
      <h1 className="guard-title mt-4 font-semibold leading-[.93] tracking-[-.055em]">Check before funds move.</h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-slate-400">Describe, preview, and approve a policy-protected payment. Only your wallet can sign.</p>
    </section>
    {error && <Notice error>{error}</Notice>}
    <div className="grid gap-7 lg:grid-cols-[330px_1fr]">
      <Card className="h-fit p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">Payment readiness</p>
        <h2 className="mt-2 text-lg font-semibold">{wallet ? short(wallet) : "Wallet not connected"}</h2>
        <WalletConnectionButtons onConnect={connect} busy={!config || Boolean(busy)} connected={Boolean(wallet)} className="mt-5" />
        {wallet && <div className="mt-5 space-y-2">
          <ReadinessItem label="Wallet connected" ready />
          <ReadinessItem label="BOT Testnet · 968" ready={readiness?.chain_id === 968} />
          <ReadinessItem label={readiness ? `${trimAmount(readiness.balance_bot)} BOT available` : "Checking balance"} ready={Number(readiness?.balance_bot || 0) > 0} />
          <ReadinessItem label={policy?.paused ? "Safety Policy paused" : "Safety Policy active"} ready={Boolean(policy && !policy.paused)} />
          <ReadinessItem label={recipients.length ? `${recipients.length} trusted recipient${recipients.length > 1 ? "s" : ""}` : "No named recipients"} ready={recipients.length > 0} />
          <ReadinessItem
            label={readiness?.gasless_available ? "Gas sponsorship active" : readiness?.bundler_available ? "Smart-wallet bundler ready" : "Bundler unavailable"}
            description={readiness?.gasless_available
              ? "Supported smart-wallet transactions can use sponsored network fees."
              : readiness?.bundler_available
                ? "Bundler is available, but gas sponsorship is inactive. Your wallet still pays gas in BOT."
                : "Standard wallet payments still work, but smart-wallet routing is unavailable."}
            ready={Boolean(readiness?.bundler_available)}
            warn={Boolean(readiness?.bundler_available && !readiness?.gasless_available)}
          />
        </div>}
        {readiness && Number(readiness.balance_bot) <= 0.001 && <a href={readiness.faucet_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs font-semibold text-amber-200">Get test BOT <Icon name="arrow" size={14} /></a>}
        {wallet && !notifications && <button onClick={() => void turnOnNotifications()} className="mt-4 w-full rounded-lg border border-white/[.1] px-3 py-2 text-left text-xs text-slate-400 hover:text-white">Enable confirmation notifications</button>}
        <Divider />
        {policy ? <>
          <Row label="Per transaction" value={<Mono>{policy.per_transaction_limit_bot} BOT</Mono>} />
          <Row label="Daily remaining" value={<Mono>{trimAmount(String(Math.max(0, Number(policy.daily_limit_bot) - Number(policy.spent_today_bot))))} BOT</Mono>} />
          <Row label="Payment mode" value={readiness?.gasless_available ? "Sponsored gas" : "Wallet gas"} />
        </> : <p className="text-xs leading-5 text-slate-500">Create a policy in Safety Policy before paying.</p>}
        {config && <><Divider /><a className="text-xs text-indigo-300 underline" target="_blank" rel="noreferrer" href={config.explorer_url + "/address/" + config.contract_address}>View live contract</a></>}
      </Card>

      <div>
        {requestName && <div className="mb-4 flex items-start gap-3 rounded-xl border border-indigo-400/25 bg-indigo-400/10 p-4"><Icon name="check" /><div><p className="text-sm font-semibold">Payment request loaded</p><p className="mt-1 text-xs text-slate-400">{requestName}. Verify every field before approving.</p></div></div>}
        <Card className="p-6 md:p-8">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Step 1 of 2</p>
          <h2 className="mt-1 font-semibold">Describe the payment</h2>
          <textarea value={prompt} onChange={(event) => { setPrompt(event.target.value); invalidatePaymentState(); }} className="input mt-5 min-h-40 resize-none text-base leading-7" placeholder="Example: Send 0.01 BOT to Alice for the testnet demo" />
          {recipients.length > 0 ? <div className="mt-4">
            <p className="text-xs text-slate-400">Trusted recipients</p>
            <div className="mt-2 flex flex-wrap gap-2">{recipients.map((recipient) => <button key={recipient.address} type="button" onClick={() => { setPrompt(`Send 0.01 BOT to ${recipient.name}`); invalidatePaymentState(); }} className="rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1.5 text-xs font-medium text-indigo-200 hover:bg-indigo-400/20">{recipient.name}</button>)}</div>
          </div> : <p className="mt-4 text-xs leading-5 text-slate-500">Name an allowlisted recipient in Safety Policy, or open a valid payment request link.</p>}
          {templates.length > 0 && <div className="mt-4"><p className="text-xs text-slate-400">Saved templates</p><div className="mt-2 space-y-2">{templates.map((template) => <div key={template.id} className="flex items-center gap-2 rounded-lg border border-white/[.08] bg-white/[.03] p-2"><button onClick={() => applyTemplate(template)} className="min-w-0 flex-1 text-left"><b className="block truncate text-xs">{template.name}</b><span className="text-[10px] text-slate-500">{template.amount_bot} BOT · {template.recipient_name || short(template.recipient)}</span></button><button aria-label={`Remove ${template.name} template`} onClick={() => setTemplates(removeTemplate(wallet, template.id))} className="p-2 text-slate-500 hover:text-rose-300"><Icon name="x" size={14} /></button></div>)}</div></div>}
          <MBtn onClick={check} disabled={!wallet || !prompt.trim() || Boolean(busy)} className="mt-5 w-full py-4">
            {busy === "check" ? <><Spinner />Checking policy and balance…</> : <><Icon name="shield" />Check payment</>}
          </MBtn>
        </Card>

        {decision && <Card className="mt-5 p-6">
          <Pill status={decision.decision} label={decision.decision} />
          <h3 className="mt-3 text-xl font-semibold">{decision.decision === "ALLOW" ? "Safe to proceed" : decision.decision === "WARN" ? "Review carefully before proceeding" : "Payment blocked"}</h3>
          <p className="mt-2 text-sm text-slate-400">{decision.reason}</p>
          {decision.intent && <PaymentSummary intent={decision.intent} recipient={recipients.find((item) => item.address.toLowerCase() === decision.intent?.recipient.toLowerCase())} />}
          {preview && <PreviewCard preview={preview} amount={decision.intent?.amount_bot || "0"} />}
          {decision.intent && history && previousRecipientPayments === 0 && <Notice>This is the first AgentGuard payment from this wallet to the extracted recipient. Compare the complete address before approving.</Notice>}
          {similarRecipient && <Notice error>The extracted address resembles saved recipient “{similarRecipient.name}” but is not identical. Check the full address for address-poisoning risk.</Notice>}
          {duplicateCount > 0 && <Notice>The recent on-chain receipts include the same amount to this recipient {duplicateCount} time{duplicateCount > 1 ? "s" : ""}. Confirm this is not a duplicate payment.</Notice>}
          {decision.warnings.map((warning) => <Notice key={warning}>{warning}</Notice>)}
          {decision.intent && <div className="mt-4 flex items-center justify-between gap-3"><button onClick={saveCurrentTemplate} className="text-xs text-indigo-300 underline">Save as payment template</button>{saved && <span className="text-xs text-emerald-300">{saved}</span>}</div>}
          {canProceed ? receipt ? <TransactionResultButton receipt={receipt} /> : <MBtn onClick={approve} disabled={busy === "approve"} variant={decision.decision === "WARN" ? "amber" : "approve"} className="mt-5 w-full py-3">{busy === "approve" ? <><Spinner />Awaiting wallet confirmation…</> : <><Icon name="wallet" />{decision.decision === "WARN" ? "Review and approve in wallet" : "Approve in wallet"}</>}</MBtn> : decision.decision === "BLOCK" ? <p className="mt-5 text-xs text-slate-500">Blocked payments never open a wallet request.</p> : <p className="mt-5 text-xs text-amber-300">{preview ? preview.reason : "Waiting for contract simulation."}</p>}
          {receipt && <Notice success={receipt.status === "confirmed"} error={receipt.status === "reverted"}><a className="underline" target="_blank" rel="noreferrer" href={receipt.explorer_url}>Transaction {receipt.status}; open BOTScan</a></Notice>}
        </Card>}
      </div>
    </div>
  </motion.div>;
}

function ReadinessItem({ label, ready, warn = false, description }: { label: string; ready: boolean; warn?: boolean; description?: string }) {
  const statusLabel = ready ? warn ? "Available with limitations" : "Ready" : "Unavailable";
  return <div className="flex items-start justify-between gap-3 rounded-lg bg-white/[.035] px-3 py-2 text-xs">
    <span className="min-w-0 text-slate-400">
      <span className="block">{label}</span>
      {description && <span className="mt-1 block text-[10px] leading-4 text-slate-500">{description}</span>}
    </span>
    <span aria-label={statusLabel} title={statusLabel} className={`mt-0.5 shrink-0 ${ready ? warn ? "text-amber-300" : "text-emerald-300" : "text-rose-300"}`}><Icon name={ready ? warn ? "warning" : "check" : "x"} size={14} /></span>
  </div>;
}

function PreviewCard({ preview, amount }: { preview: SimulationPreview; amount: string }) {
  return <div className="mt-5 rounded-xl border border-white/[.08] bg-[#0d1213] p-4"><div className="flex items-center justify-between"><h4 className="text-sm font-semibold">Smart payment preview</h4><Pill status={preview.allowed ? "ALLOW" : "BLOCK"} label={preview.allowed ? "SIMULATED" : "FAILED"} /></div><div className="mt-3 grid gap-x-7 sm:grid-cols-2"><Row label="Balance before" value={<Mono>{trimAmount(preview.wallet_balance_bot || "—")} BOT</Mono>} /><Row label="Payment" value={<Mono>{amount} BOT</Mono>} /><Row label="Estimated gas" value={<Mono>{preview.estimated_gas?.toLocaleString() || "—"}</Mono>} /><Row label="Estimated fee" value={<Mono>{trimAmount(preview.estimated_fee_bot || "—")} BOT</Mono>} /><Row label="Balance after" value={<Mono>{trimAmount(preview.balance_after_bot || "—")} BOT</Mono>} /><Row label="Contract" value={<Mono>{preview.contract_address ? short(preview.contract_address) : "—"}</Mono>} /></div></div>;
}

function TransactionResultButton({ receipt }: { receipt: TransactionStatus }) {
  const confirmed = receipt.status === "confirmed";
  const reverted = receipt.status === "reverted";
  return <MBtn disabled variant={reverted ? "danger" : "approve"} className="mt-5 w-full cursor-default py-3 disabled:opacity-100">{confirmed ? <><Icon name="check" />Payment succeeded</> : reverted ? <><Icon name="x" />Transaction reverted</> : <><Spinner />Transaction submitted</>}</MBtn>;
}

function Notice({ children, error = false, success = false }: { children: React.ReactNode; error?: boolean; success?: boolean }) {
  return <div className={"mt-4 rounded-lg border px-3 py-2 text-xs " + (error ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : success ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-200")}>{children}</div>;
}

function PaymentSummary({ intent, recipient }: { intent: NonNullable<GuardDecision["intent"]>; recipient?: SavedRecipient }) {
  return <div className="mt-4"><Row label="Recipient" value={recipient?.name || "Verified recipient"} /><Row label="Wallet address" value={<span className="flex min-w-0 items-center gap-1"><Mono className="break-all text-xs">{intent.recipient}</Mono><CopyBtn text={intent.recipient} /></span>} /><Row label="Amount" value={<Mono>{intent.amount_bot} BOT</Mono>} /><Row label="Network" value="BOT Testnet · 968" /><Row label="Purpose" value={intent.purpose || "Not supplied"} /><p className="mt-4 text-xs leading-5 text-slate-500">Check the exact address, amount, network, balance impact, and contract before approving.</p></div>;
}

function trimAmount(value: string): string {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString(undefined, { maximumFractionDigits: 8 }) : value;
}

function message(reason: unknown) { return reason instanceof Error ? reason.message : "Unexpected wallet or API error"; }
