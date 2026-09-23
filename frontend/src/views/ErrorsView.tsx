"use client";

import { motion } from "framer-motion";
import { formatUnits, parseUnits } from "ethers";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { WalletConnectionButtons } from "../components/WalletConnectionButtons";
import type { EvaluationActivity } from "../lib/activity";
import type { RecoveryIssue } from "../lib/recovery";
import {
  connectWallet,
  ensureBotTestnet,
  getHealth,
  getPublicConfig,
  newIntentHash,
  readinessOf,
  simulatePayment,
  type Eip1193Provider,
  type HealthStatus,
  type PublicConfig,
  type SimulationPreview,
  type WalletConnectionMode,
  type WalletReadiness,
} from "../lib/botchain";
import { Card, Icon, MBtn, Mono, Pill, Spinner, T, fadeUp, short, stagger } from "../shared";

type Connection = { account: string; provider: Eip1193Provider };
type WalletIssue = { message: string; rejected: boolean };

export default function ErrorsView({
  evaluation,
  latestIssue,
  onRetryPayment,
}: {
  evaluation: EvaluationActivity | null;
  latestIssue: RecoveryIssue | null;
  onRetryPayment: () => void;
}) {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [configError, setConfigError] = useState("");
  const [connection, setConnection] = useState<Connection | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [readiness, setReadiness] = useState<WalletReadiness | null>(null);
  const [preview, setPreview] = useState<SimulationPreview | null>(null);
  const [balanceError, setBalanceError] = useState("");
  const [walletIssue, setWalletIssue] = useState<WalletIssue | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthError, setHealthError] = useState("");
  const [lastHealthCheck, setLastHealthCheck] = useState<Date | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [switchingNetwork, setSwitchingNetwork] = useState(false);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [checkingRpc, setCheckingRpc] = useState(false);

  const refreshRpc = useCallback(async () => {
    setCheckingRpc(true);
    setHealthError("");
    try {
      setHealth(await getHealth());
    } catch (reason) {
      setHealth(null);
      setHealthError(message(reason, "AgentGuard health check is unavailable."));
    } finally {
      setLastHealthCheck(new Date());
      setCheckingRpc(false);
    }
  }, []);

  useEffect(() => {
    getPublicConfig()
      .then((value) => {
        setConfig(value);
        setConfigError("");
      })
      .catch((reason) => setConfigError(message(reason, "Public BOT Chain configuration is unavailable.")));
    void refreshRpc();
  }, [refreshRpc]);

  const refreshBalance = useCallback(async (account: string) => {
    setCheckingBalance(true);
    setBalanceError("");
    try {
      const nextReadiness = await readinessOf(account);
      setReadiness(nextReadiness);
      const intent = evaluation?.wallet.toLowerCase() === account.toLowerCase()
        ? evaluation.decision.intent
        : null;
      if (intent) {
        setPreview(await simulatePayment(account, intent.recipient, intent.amount_bot, newIntentHash()));
      } else {
        setPreview(null);
      }
    } catch (reason) {
      setBalanceError(message(reason, "Unable to read this wallet from BOT Testnet."));
      setPreview(null);
    } finally {
      setCheckingBalance(false);
    }
  }, [evaluation]);

  useEffect(() => {
    if (connection) void refreshBalance(connection.account);
  }, [connection?.account, evaluation, refreshBalance]);

  useEffect(() => {
    if (!connection) return;
    const { provider } = connection;
    const accountsChanged = (...args: unknown[]) => {
      const account = ((args[0] as string[] | undefined) || [])[0] || "";
      if (!account) {
        setConnection(null);
        setChainId(null);
        setReadiness(null);
        setPreview(null);
        return;
      }
      setConnection({ provider, account });
    };
    const chainChanged = (...args: unknown[]) => {
      setChainId(parseChainId(args[0]));
    };
    provider.on?.("accountsChanged", accountsChanged);
    provider.on?.("chainChanged", chainChanged);
    return () => {
      provider.removeListener?.("accountsChanged", accountsChanged);
      provider.removeListener?.("chainChanged", chainChanged);
    };
  }, [connection?.provider]);

  async function connect(mode: WalletConnectionMode) {
    if (!config) return;
    setConnecting(true);
    setWalletIssue(null);
    try {
      const next = await connectWallet(config, mode);
      const nextChainId = parseChainId(await next.provider.request({ method: "eth_chainId" }));
      setConnection({ account: next.account, provider: next.provider });
      setChainId(nextChainId);
    } catch (reason) {
      setWalletIssue(walletError(reason));
    } finally {
      setConnecting(false);
    }
  }

  async function switchNetwork() {
    if (!config || !connection) return;
    setSwitchingNetwork(true);
    setWalletIssue(null);
    try {
      await ensureBotTestnet(config, connection.provider);
      setChainId(parseChainId(await connection.provider.request({ method: "eth_chainId" })));
      await refreshBalance(connection.account);
    } catch (reason) {
      setWalletIssue(walletError(reason));
    } finally {
      setSwitchingNetwork(false);
    }
  }

  const networkReady = Boolean(config && connection && chainId === config.chain_id);
  const networkLabel = networkReady ? "CONNECTED" : connection ? "WRONG NETWORK" : "NOT CONNECTED";
  const rpcReady = health?.botchain_rpc.status === "ok";
  const requiredBalance = useMemo(() => {
    if (!evaluation || !connection || evaluation.wallet.toLowerCase() !== connection.account.toLowerCase()) return null;
    const intent = evaluation.decision.intent;
    if (!intent) return null;
    return addBot(intent.amount_bot, preview?.estimated_fee_bot || "0");
  }, [connection?.account, evaluation, preview?.estimated_fee_bot]);
  const insufficient = Boolean(
    preview?.reason.toLowerCase().includes("insufficient") ||
    (requiredBalance && readiness && lessThan(readiness.balance_bot, requiredBalance)),
  );

  return <motion.div {...fadeUp}>
    <div className="mb-7">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-400">Live recovery</p>
      <h1 className="mt-2 text-3xl font-semibold">Wallet and network diagnostics</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">These checks use your selected wallet, the AgentGuard API, and BOT Testnet. Values are live or returned by a real contract dry-run—none are hardcoded.</p>
    </div>
    {configError && <Notice error>{configError}</Notice>}

    <motion.div variants={stagger} initial="initial" animate="animate" className="grid gap-5 md:grid-cols-2">
      <DiagnosticCard color={networkReady ? T.allow : T.blue} icon="warning" title="Wallet Network">
        <p className="text-sm leading-6 text-slate-400">
          {connection
            ? networkReady
              ? `Your wallet is connected to ${config?.chain_name || "BOT Testnet"}.`
              : `Your wallet reports chain ${chainId ?? "unknown"}; AgentGuard requires chain ${config?.chain_id ?? 968}.`
            : "Connect a wallet to verify its active network and switch to BOT Testnet when needed."}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Pill status={networkReady ? "ALLOW" : connection ? "WARN" : "BLOCK"} label={networkLabel} />
          {connection && <Mono className="text-xs text-slate-500">{short(connection.account)}</Mono>}
        </div>
        {!connection ? <WalletConnectionButtons
          onConnect={connect}
          busy={!config || connecting}
          busyLabel="Connecting…"
          className="mt-5"
        /> : <MBtn
          onClick={() => void switchNetwork()}
          disabled={!config || switchingNetwork || checkingBalance}
          variant={networkReady ? "secondary" : "primary"}
          className="mt-5"
        >
          {switchingNetwork ? <><Spinner />Switching…</> : networkReady ? "Re-check BOT Testnet" : "Switch to BOT Testnet"}
        </MBtn>}
      </DiagnosticCard>

      <DiagnosticCard color={walletIssue || latestIssue?.kind === "wallet_rejected" ? T.block : T.allow} icon={walletIssue || latestIssue?.kind === "wallet_rejected" ? "x" : "wallet"} title="Wallet Approval">
        <p className="text-sm leading-6 text-slate-400">
          {walletIssue
            ? walletIssue.message
            : latestIssue?.kind === "wallet_rejected"
              ? latestIssue.message
            : "No rejected wallet request has been recorded on this diagnostics page. Payment signatures are requested only after a live policy and contract simulation pass."}
        </p>
        <div className="mt-4">
          <Pill
            status={walletIssue || latestIssue?.kind === "wallet_rejected" ? "BLOCK" : "ALLOW"}
            label={walletIssue ? walletIssue.rejected ? "CANCELLED" : "WALLET ERROR" : latestIssue?.kind === "wallet_rejected" ? "CANCELLED" : "READY"}
          />
        </div>
        <MBtn variant={walletIssue || latestIssue?.kind === "wallet_rejected" ? "danger" : "secondary"} onClick={onRetryPayment} className="mt-5">
          {evaluation?.decision.intent ? "Retry latest payment" : "Start a payment check"}
        </MBtn>
      </DiagnosticCard>

      <DiagnosticCard color={insufficient ? T.warn : readiness ? T.allow : T.warn} icon="warning" title="Live Wallet Balance">
        <p className="text-sm leading-6 text-slate-400">
          {!connection
            ? "Connect a wallet above to read its current BOT balance."
            : balanceError
              ? balanceError
              : evaluation && evaluation.wallet.toLowerCase() !== connection.account.toLowerCase()
                ? "The latest payment belongs to a different wallet. Open Check Payment to evaluate one for this account."
                : requiredBalance
                  ? insufficient ? "This wallet cannot cover the latest payment and estimated gas." : "This wallet can cover the latest payment and estimated gas."
                  : "Balance is live. Evaluate a payment to calculate its required amount and gas."}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <ValueBox label="Available" value={readiness ? `${trimAmount(readiness.balance_bot)} BOT` : checkingBalance ? "Checking…" : "—"} warn={insufficient} />
          <ValueBox label="Payment + gas" value={requiredBalance ? `${trimAmount(requiredBalance)} BOT` : "Not evaluated"} />
        </div>
        {preview?.estimated_fee_bot && <p className="mt-3 text-xs text-slate-500">Estimated gas: <Mono>{trimAmount(preview.estimated_fee_bot)} BOT</Mono></p>}
        <div className="mt-5 flex flex-wrap gap-2">
          <MBtn variant="secondary" onClick={() => connection && void refreshBalance(connection.account)} disabled={!connection || checkingBalance}>
            {checkingBalance ? <><Spinner />Refreshing…</> : "Refresh balance"}
          </MBtn>
          {readiness && insufficient && <a href={readiness.faucet_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-200">Open testnet faucet <Icon name="arrow" size={15} /></a>}
        </div>
      </DiagnosticCard>

      <DiagnosticCard color={rpcReady ? T.allow : "#f97316"} icon={rpcReady ? "check" : "warning"} title="BOT Chain RPC">
        <p className="text-sm leading-6 text-slate-400">
          {health
            ? health.botchain_rpc.detail || (rpcReady ? "The configured RPC and AgentGuard contract are reachable." : "The configured RPC or contract check failed.")
            : healthError || "Checking the AgentGuard API and BOT Chain RPC…"}
        </p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <div>
            <Pill status={rpcReady ? "ALLOW" : health || healthError ? "BLOCK" : "WARN"} label={rpcReady ? "REACHABLE" : health || healthError ? "UNREACHABLE" : "CHECKING"} />
            {lastHealthCheck && <p className="mt-2 text-[10px] text-slate-600">Checked {lastHealthCheck.toLocaleTimeString()}</p>}
          </div>
          <MBtn variant="secondary" onClick={() => void refreshRpc()} disabled={checkingRpc} className="px-3 py-2 text-xs">
            {checkingRpc ? <Spinner /> : <span aria-hidden="true">↻</span>} Check again
          </MBtn>
        </div>
      </DiagnosticCard>
    </motion.div>
  </motion.div>;
}

function DiagnosticCard({ color, icon, title, children }: { color: string; icon: string; title: string; children: ReactNode }) {
  return <motion.div variants={{ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } }}>
    <Card className="relative h-full overflow-hidden p-6">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: `${color}18`, color }}><Icon name={icon} size={21} /></div>
        <div className="min-w-0 flex-1"><h2 className="font-semibold">{title}</h2><div className="mt-2">{children}</div></div>
      </div>
    </Card>
  </motion.div>;
}

function ValueBox({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return <div className={`rounded-xl p-3 ${warn ? "bg-amber-500/[.07]" : "bg-white/[.035]"}`}><span className="text-xs text-slate-500">{label}</span><b className={`mt-1 block break-words mono ${warn ? "text-amber-400" : ""}`}>{value}</b></div>;
}

function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={`mb-5 rounded-lg border px-4 py-3 text-xs ${error ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}>{children}</div>;
}

function parseChainId(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parsed = Number.parseInt(value, value.startsWith("0x") ? 16 : 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function addBot(left: string, right: string): string | null {
  try {
    return formatUnits(parseUnits(left, 18) + parseUnits(right, 18), 18);
  } catch {
    return null;
  }
}

function lessThan(left: string, right: string): boolean {
  try {
    return parseUnits(left, 18) < parseUnits(right, 18);
  } catch {
    return false;
  }
}

function trimAmount(value: string): string {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString(undefined, { maximumFractionDigits: 8 }) : value;
}

function walletError(reason: unknown): WalletIssue {
  const value = reason as { code?: number; message?: string } | null;
  const text = message(reason, "The wallet request failed.");
  return {
    message: text,
    rejected: value?.code === 4001 || /reject|denied|cancel/i.test(text),
  };
}

function message(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : typeof reason === "object" && reason && "message" in reason ? String(reason.message) : fallback;
}
