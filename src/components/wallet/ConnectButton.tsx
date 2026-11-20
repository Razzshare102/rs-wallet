"use client";

import { useState } from "react";
import Link from "next/link";
import { LogOut, Wallet } from "lucide-react";
import { useAccount, useConnect, useConnectors, useDisconnect } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { Button } from "@/components/ui/button";
import { hasReownProjectId } from "@/lib/env";
import { shortenAddress } from "@/lib/utils";

/** Opens the Reown AppKit modal (MetaMask, Rabby, Coinbase, WalletConnect…). */
function AppKitConnectButton() {
  const { open } = useAppKit();
  return (
    <Button variant="gradient" size="sm" className="h-10 rounded-full px-4" onClick={() => open()}>
      <Wallet className="size-4" /> Connect wallet
    </Button>
  );
}

/** Fallback when no Reown Project ID is configured: injected + Coinbase connectors via wagmi. */
function DirectConnectButton() {
  const connectors = useConnectors();
  const { connect, isPending, error } = useConnect();
  const [open, setOpen] = useState(false);
  const usable = connectors.filter((c) => c.id === "injected" || c.id === "coinbaseWalletSDK");

  if (!open) {
    return (
      <Button
        variant="gradient"
        size="sm"
        className="h-10 rounded-full px-4"
        onClick={() => (usable.length === 1 ? connect({ connector: usable[0] }) : setOpen(true))}
      >
        <Wallet className="size-4" /> Connect wallet
      </Button>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-1.5">
        {usable.map((c) => (
          <Button key={c.uid} size="sm" variant="secondary" disabled={isPending} onClick={() => connect({ connector: c })}>
            {c.name}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {error && <p className="text-[11px] text-destructive">{error.message}</p>}
      {!hasReownProjectId && (
        <p className="max-w-[240px] text-right text-[11px] text-muted-foreground">
          WalletConnect needs a Reown Project ID (see Settings → Security Center).
        </p>
      )}
    </div>
  );
}

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-1.5">
        <Button asChild variant="secondary" size="sm" className="h-10 rounded-full px-4 font-mono text-[13px]">
          <Link href="/accounts">{shortenAddress(address)}</Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full"
          onClick={() => disconnect()}
          aria-label="Disconnect external wallet"
          title="Disconnect"
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    );
  }

  return hasReownProjectId ? <AppKitConnectButton /> : <DirectConnectButton />;
}
