"use client";

import { motion } from "framer-motion";
import QRCode from "qrcode";
import { isAddress } from "ethers";
import { useEffect, useMemo, useState } from "react";
import { isValidBotAmount } from "../lib/amount";
import { Card, CopyBtn, Icon, Label, MBtn, Mono, fadeUp } from "../shared";

type RequestData = { recipient: string; amount: string; purpose: string; name: string };

export default function PaymentRequestView() {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("0.01");
  const [purpose, setPurpose] = useState("");
  const [name, setName] = useState("");
  const [request, setRequest] = useState<RequestData | null>(null);
  const [qr, setQr] = useState("");
  const amountValid = isValidBotAmount(amount);
  const valid = isAddress(recipient) && amountValid && purpose.trim().length <= 160 && name.trim().length <= 64;
  const link = useMemo(() => {
    if (!request || typeof window === "undefined") return "";
    const params = new URLSearchParams({ recipient: request.recipient, amount: request.amount });
    if (request.purpose) params.set("purpose", request.purpose);
    if (request.name) params.set("name", request.name);
    return `${window.location.origin}/pay?${params.toString()}`;
  }, [request]);

  useEffect(() => {
    let cancelled = false;
    setQr("");
    if (!link) return () => { cancelled = true; };
    QRCode.toDataURL(link, { width: 320, margin: 2, color: { dark: "#080b0c", light: "#f4efe1" } })
      .then((value) => { if (!cancelled) setQr(value); })
      .catch(() => { if (!cancelled) setQr(""); });
    return () => { cancelled = true; };
  }, [link]);

  function generate() {
    if (!valid) return;
    setRequest({ recipient, amount, purpose: purpose.trim(), name: name.trim() });
  }

  async function share() {
    if (!link) return;
    if (navigator.share) {
      await navigator.share({ title: "AgentGuard payment request", text: `${request?.name || "Payment"} · ${request?.amount} BOT`, url: link });
    } else {
      await navigator.clipboard?.writeText(link);
    }
  }

  return <motion.div {...fadeUp}>
    <div className="mb-7">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-400">Request to pay</p>
      <h1 className="mt-2 text-3xl font-semibold">Pay by link or QR</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Create a payment request that opens AgentGuard with the recipient, amount, and purpose already filled in. The payer still receives a risk check and approves in their own wallet.</p>
    </div>
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card className="p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Recipient wallet</Label><input className="input mono" value={recipient} onChange={(event) => setRecipient(event.target.value.trim())} placeholder="0x…" /></div>
          <div><Label>Display name (optional)</Label><input className="input" value={name} maxLength={64} onChange={(event) => setName(event.target.value)} placeholder="Agent, Alice, Store…" /></div>
          <div><Label>Amount</Label><div className="relative"><input className="input mono pr-16" value={amount} maxLength={37} inputMode="decimal" onChange={(event) => setAmount(event.target.value)} /><span className="absolute right-4 top-3.5 text-xs text-slate-500">BOT</span></div></div>
          <div className="sm:col-span-2"><Label>Purpose</Label><input className="input" value={purpose} maxLength={160} onChange={(event) => setPurpose(event.target.value)} placeholder="Invoice, service, purchase…" /></div>
        </div>
        <MBtn onClick={generate} disabled={!valid} className="mt-5 w-full py-3"><Icon name="check" />Generate secure request</MBtn>
        <p className="mt-3 text-xs leading-5 text-slate-500">The link contains payment details only. It cannot sign, approve, or move funds.</p>
      </Card>
      <Card className="grid min-h-[420px] place-items-center p-6 text-center">
        {link ? <div className="w-full">
          {qr && <img src={qr} alt="AgentGuard payment request QR code" className="mx-auto w-56 rounded-xl bg-[#f4efe1] p-2" />}
          <h2 className="mt-5 font-semibold">{request?.name || "Payment request"}</h2>
          <p className="mt-1 text-2xl font-semibold text-emerald-300">{request?.amount} BOT</p>
          <div className="mt-4 flex min-w-0 items-center justify-center gap-1 rounded-lg bg-white/[.04] p-3"><Mono className="truncate text-xs">{link}</Mono><CopyBtn text={link} /></div>
          <MBtn variant="secondary" onClick={() => void share().catch(() => undefined)} className="mt-4 w-full">Share request</MBtn>
        </div> : <div><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-indigo-500/10 text-indigo-300"><Icon name="copy" size={25} /></div><h2 className="mt-4 font-semibold">Your QR will appear here</h2><p className="mt-2 text-xs leading-5 text-slate-500">Complete the valid wallet and amount fields to generate a request.</p></div>}
      </Card>
    </div>
  </motion.div>;
}
