"use client";

import Link from "next/link";
import { ArrowDown, ArrowLeftRight, ArrowUp, Check, Copy, History } from "lucide-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useVault } from "@/components/wallet/VaultProvider";
import { useRsChain } from "@/components/wallet/ChainProvider";
import { useBalances } from "@/hooks/useBalances";
import { useActivity } from "@/hooks/useActivity";
import { usePrices } from "@/hooks/usePrices";
import { ActivityList } from "@/components/wallet/ActivityList";
import { usdValue } from "@/lib/prices";
import { formatUsd, shortenAddress } from "@/lib/utils";

function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-1.5 font-mono text-xs text-secondary-foreground transition-colors hover:bg-secondary/70"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(address);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard unavailable */
        }
      }}
      title="Copy address"
    >
      {shortenAddress(address, 6)}
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
    </button>
  );
}

const AVATAR_COLORS = ["#0500ff", "#0091ff", "#00b897", "#f0b90b", "#7a5cff", "#ff6b9d", "#0ea5e9"];

function TokenAvatar({ symbol }: { symbol: string }) {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0;
  const bg = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  return (
    <span
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
      style={{ backgroundColor: bg }}
      aria-hidden
    >
      {symbol.slice(0, 2).toUpperCase()}
    </span>
  );
}

function QuickAction({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: typeof ArrowUp;
}) {
  return (
    <Link href={href} className="group flex flex-col items-center gap-2">
      <span className="flex size-14 items-center justify-center rounded-full bg-secondary transition-colors group-hover:bg-secondary/60">
        <Icon className="size-6" />
      </span>
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}

export default function DashboardPage() {
  const { address, source, isConnected } = useActiveAccount();
  const { status: vaultStatus } = useVault();
  const { chainId, network } = useRsChain();
  const { entries, isLoading: balancesLoading } = useBalances(address, network);
  const { txs: activityTxs } = useActivity(address, network);
  const nativeEntry = entries.find((e) => e.kind === "native");
  const tokenEntries = entries.filter((e) => e.kind === "erc20");
  const { priceFor } = usePrices(
    chainId,
    tokenEntries.map((e) => e.token!.address),
  );
  const valued = entries.map((e) => ({
    entry: e,
    usd: usdValue(e.balance, e.decimals, priceFor(e.token?.address ?? null)),
  }));
  const pricedCount = valued.filter((v) => v.usd !== null && v.entry.balance > 0n).length;
  const totalUsd = pricedCount > 0 ? valued.reduce((sum, v) => sum + (v.usd ?? 0), 0) : null;
  const listEntries = entries.filter((e) => e.kind === "native" || e.balance > 0n).slice(0, 6);

  if (!isConnected || !address) {
    return vaultStatus === "locked" ? (
      <Card className="glass mx-auto max-w-xl">
        <CardContent className="flex flex-col items-center px-6 py-14 text-center">
          <h2 className="text-xl font-semibold">Wallet is locked</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Your built-in wallet is encrypted on this device. Unlock it with your password to see
            balances and use your accounts.
          </p>
          <Button asChild variant="gradient" className="mt-6">
            <Link href="/unlock">Unlock wallet</Link>
          </Button>
        </CardContent>
      </Card>
    ) : (
      <Card className="glass mx-auto max-w-xl">
        <CardContent className="flex flex-col items-center px-6 py-14 text-center">
          <h2 className="text-xl font-semibold">No wallet active</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Create a built-in wallet or import one with your recovery phrase to see real balances
            here. Nothing is displayed until an account is active — RS WALLET never shows
            fabricated data.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button asChild variant="gradient">
              <Link href="/create">Create wallet</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/import">Import wallet</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      {/* Trust Wallet-style home header: account pill, big centred balance */}
      <div className="flex flex-col items-center pt-2 text-center">
        <div className="flex items-center gap-2">
          <CopyAddress address={address} />
          <span className="rounded-full bg-primary/15 px-2.5 py-1.5 text-[11px] font-semibold text-accent">
            {source === "external" ? "External" : "Built-in"}
          </span>
        </div>
        <p className="mt-6 text-sm font-medium text-muted-foreground">
          Total balance · {network?.name ?? `Chain ${chainId}`}
        </p>
        {balancesLoading ? (
          <Skeleton className="mt-2 h-12 w-52" />
        ) : totalUsd !== null ? (
          <p className="mt-1 text-[42px] font-bold leading-none tracking-tight">{formatUsd(totalUsd)}</p>
        ) : (
          <p className="mt-1 text-[42px] font-bold leading-none tracking-tight">
            {nativeEntry ? `${nativeEntry.formatted} ${nativeEntry.symbol}` : "—"}
          </p>
        )}
        <p className="mt-3 max-w-sm text-xs leading-relaxed text-muted-foreground">
          {totalUsd !== null
            ? `Covers ${pricedCount} priced asset${pricedCount === 1 ? "" : "s"} (CoinGecko). Unpriced tokens are excluded, never guessed.`
            : network?.testnet
              ? "Testnet assets have no market price, so no USD total is shown."
              : "USD prices are unavailable right now, so amounts are shown in token units."}
        </p>
      </div>

      {/* Quick actions */}
      <div className="mt-8 flex items-start justify-center gap-7 sm:gap-9">
        <QuickAction href="/send" label="Send" icon={ArrowUp} />
        <QuickAction href="/receive" label="Receive" icon={ArrowDown} />
        <QuickAction href="/swap" label="Swap" icon={ArrowLeftRight} />
        <QuickAction href="/activity" label="History" icon={History} />
      </div>

      {/* Token list */}
      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Tokens</h2>
          <Link href="/assets" className="text-sm font-medium text-accent hover:underline">
            View all
          </Link>
        </div>
        {balancesLoading ? (
          <div className="mt-3 flex flex-col gap-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : listEntries.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No assets on this network yet. Add tokens on the Assets page.
          </p>
        ) : (
          <ul className="mt-1 flex flex-col">
            {listEntries.map((e) => {
              const unit = priceFor(e.token?.address ?? null);
              const usd = usdValue(e.balance, e.decimals, unit);
              const row = (
                <>
                  <TokenAvatar symbol={e.symbol} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{e.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {unit !== null ? formatUsd(unit) : (network?.name ?? "")}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-semibold">
                      {e.formatted} <span className="text-xs font-medium text-muted-foreground">{e.symbol}</span>
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {usd !== null ? formatUsd(usd) : "—"}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={e.token?.address ?? "native"} className="border-b border-border/50 last:border-0">
                  {e.token ? (
                    <Link
                      href={`/token/${e.token.address}`}
                      className="flex items-center gap-3 py-3 transition-colors hover:bg-secondary/40"
                    >
                      {row}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 py-3">{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Recent activity */}
      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Recent activity</h2>
          <Link href="/activity" className="text-sm font-medium text-accent hover:underline">
            View all
          </Link>
        </div>
        <div className="mt-3">
          <ActivityList
            txs={activityTxs.slice(0, 5)}
            network={network}
            emptyMessage="No transactions on this network yet."
          />
        </div>
      </div>
    </div>
  );
}
