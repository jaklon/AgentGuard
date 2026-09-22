"use client";

import { useEffect, useState } from "react";
import { connectWallet, getPublicConfig, policyOf, setPolicy, setRecipient, setWalletPaused, type Eip1193Provider, type Policy, type PublicConfig, type WalletConnectionMode } from "../lib/botchain";
import { loadRecipients, removeRecipient, saveRecipient } from "../lib/recipients";
import { WalletConnectionButtons } from "../components/WalletConnectionButtons";
import { Card, Divider, Label, MBtn, Mono, Row, fadeUp, short } from "../shared";
import { motion } from "framer-motion";

export default function LivePolicyView() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [wallet, setWallet] = useState("");
  const [walletProvider, setWalletProvider] = useState<Eip1193Provider | null>(null);
  const [policy, setPolicyState] = useState<Policy | null>(null);
  const [perTx, setPerTx] = useState("0.02");
  const [daily, setDaily] = useState("0.10");
  const [recipient, setRecipientInput] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [transaction, setTransaction] = useState("");

  useEffect(() => { getPublicConfig().then(setConfig).catch((e: Error) => setError(e.message)); }, []);

  async function refresh(account: string) {
    const nextPolicy = await policyOf(account);
    setPolicyState(nextPolicy);
    setNames(Object.fromEntries(loadRecipients(account, nextPolicy.allowed_recipients).map((item) => [item.address.toLowerCase(), item.name])));
  }

  async function connect(mode: WalletConnectionMode) {
    if (!config) return;
    setBusy(true); setError("");
    try { const connection = await connectWallet(config, mode); setWallet(connection.account); setWalletProvider(connection.provider); await refresh(connection.account); }
    catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }

  async function savePolicy() {
    if (!config || !wallet || !walletProvider) return;
    setBusy(true); setError("");
    try { const expires = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; setTransaction(await setPolicy(config, walletProvider, perTx, daily, expires, true)); await refresh(wallet); }
    catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }

  async function addRecipient() {
    if (!config || !wallet || !walletProvider || !recipient || !recipientName.trim()) return;
    setBusy(true); setError("");
    try {
      setTransaction(await setRecipient(config, walletProvider, recipient, true));
      saveRecipient(wallet, { name: recipientName, address: recipient });
      setRecipientInput(""); setRecipientName("");
      await refresh(wallet);
    } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }

  async function removeAllowedRecipient(address: string) {
    if (!config || !wallet || !walletProvider) return;
    setBusy(true); setError("");
    try { setTransaction(await setRecipient(config, walletProvider, address, false)); removeRecipient(wallet, address); await refresh(wallet); }
    catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }

  function saveName(address: string) {
    const name = names[address.toLowerCase()]?.trim();
    if (!name) return setError("Enter a recipient name before saving it.");
    saveRecipient(wallet, { name, address });
    setError("");
    if (policy) setNames(Object.fromEntries(loadRecipients(wallet, policy.allowed_recipients).map((item) => [item.address.toLowerCase(), item.name])));
  }

  async function togglePause() {
    if (!config || !wallet || !walletProvider || !policy) return;
    setBusy(true); setError("");
    try { setTransaction(await setWalletPaused(config, walletProvider, !policy.paused)); await refresh(wallet); }
    catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }

  return <motion.div {...fadeUp}>
    <div className="mb-7"><p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-400">On-chain controls</p><h1 className="mt-2 text-3xl font-semibold">Safety policy</h1><p className="mt-2 text-sm text-slate-500">Every change opens your wallet; AgentGuard cannot sign for you.</p></div>
    {error && <p className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</p>}
    <div className="grid gap-6 lg:grid-cols-[1fr_310px]">
      <Card className="p-6">
        <WalletConnectionButtons onConnect={connect} busy={!config || busy} connected={Boolean(wallet)} busyLabel="Working…" />
        <Divider />
        <div className="grid gap-4 sm:grid-cols-2"><div><Label>Per-transaction limit</Label><input value={perTx} onChange={(e) => setPerTx(e.target.value)} className="input mono" inputMode="decimal" /></div><div><Label>Daily limit</Label><input value={daily} onChange={(e) => setDaily(e.target.value)} className="input mono" inputMode="decimal" /></div></div>
        <MBtn onClick={savePolicy} disabled={!wallet || busy} className="mt-5 w-full">Write policy to BOT Testnet</MBtn>
        <Divider />
        <Label>Trusted recipients</Label>
        <p className="mb-3 text-xs leading-5 text-slate-500">Give every on-chain allowlisted wallet a name. Names stay in this browser; only the wallet address is written on-chain.</p>
        <div className="space-y-2">{policy?.allowed_recipients.map((address) => <div key={address} className="rounded-lg bg-white/[.04] p-3 text-xs"><div className="flex items-center justify-between gap-3"><Mono className="text-slate-500">{address}</Mono><button className="shrink-0 text-rose-300" onClick={() => { void removeAllowedRecipient(address); }}>Remove</button></div><div className="mt-2 flex gap-2"><input value={names[address.toLowerCase()] || ""} onChange={(e) => setNames((current) => ({ ...current, [address.toLowerCase()]: e.target.value }))} className="input min-w-0 py-2 text-xs" placeholder="Recipient name, e.g. Alice" /><MBtn variant="secondary" className="px-3 py-2 text-xs" onClick={() => saveName(address)}>Save name</MBtn></div></div>)}</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1.35fr_auto]"><input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className="input" placeholder="Name, e.g. Alice" maxLength={64} /><input value={recipient} onChange={(e) => setRecipientInput(e.target.value)} className="input mono" placeholder="0x recipient address" /><MBtn variant="secondary" onClick={() => { void addRecipient(); }} disabled={!wallet || busy || !recipient || !recipientName.trim()}>Add</MBtn></div>
        <Divider />
        <div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">Wallet pause</h3><p className="text-xs text-slate-500">Immediately blocks this wallet’s payments.</p></div><MBtn variant={policy?.paused ? "approve" : "danger"} onClick={togglePause} disabled={!policy || busy}>{policy?.paused ? "Unpause" : "Pause"}</MBtn></div>
      </Card>
      <Card className="h-fit p-5"><h2 className="text-lg font-semibold">Live contract</h2><Divider /><Row label="Wallet" value={<Mono>{wallet ? short(wallet) : "—"}</Mono>} copy={wallet || undefined} /><Row label="Contract" value={<span title={config?.contract_address}><Mono>{config ? short(config.contract_address) : "Loading…"}</Mono></span>} copy={config?.contract_address} /><Row label="Network" value="BOT Testnet · 968" />{policy && <><Row label="Policy status" value={policy.paused ? "Paused" : "Active"} /><Row label="Expiry" value={policy.expires_at ? new Date(policy.expires_at).toLocaleDateString() : "—"} /></>}{transaction && config && <a className="mt-4 block text-xs text-indigo-300 underline" target="_blank" rel="noreferrer" href={config.explorer_url + "/tx/" + transaction}>View submitted transaction</a>}</Card>
    </div>
  </motion.div>;
}

function message(reason: unknown) { return reason instanceof Error ? reason.message : "Wallet transaction failed"; }
