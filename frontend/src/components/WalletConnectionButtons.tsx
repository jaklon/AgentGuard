"use client";

import { useEffect, useState } from "react";
import {
  injectedWalletAvailable,
  metaMaskDeepLink,
  walletConnectConfigured,
  type WalletConnectionMode,
} from "../lib/botchain";
import { Icon, MBtn, Spinner } from "../shared";

export function WalletConnectionButtons({
  onConnect,
  busy,
  connected = false,
  className = "",
  busyLabel = "Connecting…",
}: {
  onConnect: (mode: WalletConnectionMode) => void | Promise<void>;
  busy: boolean;
  connected?: boolean;
  className?: string;
  busyLabel?: string;
}) {
  const [ready, setReady] = useState(false);
  const [hasInjectedWallet, setHasInjectedWallet] = useState(false);
  const [deepLink, setDeepLink] = useState("https://metamask.app.link/dapp/agentguard.my.id/");
  const walletConnectReady = walletConnectConfigured();

  useEffect(() => {
    setHasInjectedWallet(injectedWalletAvailable());
    setDeepLink(metaMaskDeepLink());
    setReady(true);
  }, []);

  if (!ready) {
    return <MBtn className={className} disabled><Spinner />Detecting wallet…</MBtn>;
  }

  const primaryMode: WalletConnectionMode | null = hasInjectedWallet ? "injected" : walletConnectReady ? "walletconnect" : null;
  const primaryLabel = hasInjectedWallet
    ? connected ? "Reconnect browser wallet" : "Connect browser wallet"
    : connected ? "Reconnect WalletConnect" : "Connect with WalletConnect";

  return <div className={`space-y-2 ${className}`}>
    {primaryMode ? <MBtn
      className="w-full"
      onClick={() => void onConnect(primaryMode)}
      disabled={busy}
    >
      {busy ? <><Spinner />{busyLabel}</> : <><Icon name="wallet" />{primaryLabel}</>}
    </MBtn> : <a
      href={deepLink}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#d6c38c] px-4 py-2.5 text-sm font-semibold text-[#090c0d] transition-colors hover:bg-[#ead9a4]"
    >
      <Icon name="wallet" />Open in MetaMask app
    </a>}

    {hasInjectedWallet && walletConnectReady && <MBtn
      variant="secondary"
      className="w-full"
      onClick={() => void onConnect("walletconnect")}
      disabled={busy}
    >
      <Icon name="wallet" />WalletConnect QR
    </MBtn>}

    {(hasInjectedWallet || walletConnectReady) && <a
      href={deepLink}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:border-white/35 hover:text-white md:hidden"
    >
      Open in MetaMask app <Icon name="arrow" size={15} />
    </a>}

    {!walletConnectReady && !hasInjectedWallet && <p className="text-center text-[11px] leading-4 text-slate-500">
      Continue securely in MetaMask Mobile. You will approve inside the wallet.
    </p>}
  </div>;
}
