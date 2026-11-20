"use client";

import Link from "next/link";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/ModulePlaceholder";
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
      className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 font-mono text-xs text-secondary-foreground transition-colors hover:bg-secondary/70"
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

export default function DashboardPage() {
  const { address, source, isConnected } = useActiveAccount();
  const { status: vaultStatus } = useVault();
  const { chainId, network } = useRsChain();
  const { entries, isLoading: balancesLoading } = useBalances(address, network);
  const { txs: activityTxs } = useActivity(address, network);
  const nativeEntry = entries.find((e) => e.kind === "native");
  const tokenEntries = entries.filter((e) => e.kind === "erc20");
  const nonZeroTokens = tokenEntries.filter((e) => e.balance > 0n);
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

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Your portfolio across the active network." />

      {!isConnected || !address ? (
        vaultStatus === "locked" ? (
          <Card className="glass">
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
        <Card className="glass">
          <CardContent className="flex flex-col items-center px-6 py-14 text-center">
            <h2 className="text-xl font-semibold">No wallet active</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Create a built-in wallet, import one with your recovery phrase, or connect an external
              wallet to see real balances here. Nothing is displayed until an account is active —
              RS WALLET never shows fabricated data.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button asChild variant="gradient">
                <Link href="/create">Create wallet</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/import">Import wallet</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/">Connect external</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        )
      ) : (
        <div className="grid gap-4">
          <Card className="glass overflow-hidden">
            <CardContent className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Total balance · {network?.name ?? `Chain ${chainId}`}
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    {balancesLoading ? (
                      <Skeleton className="h-9 w-44" />
                    ) : totalUsd !== null ? (
                      <span className="text-3xl font-bold tracking-tight">{formatUsd(totalUsd)}</span>
                    ) : (
                      <span className="text-3xl font-bold tracking-tight">
                        {nativeEntry ? `${nativeEntry.formatted} ${nativeEntry.symbol}` : "—"}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {nativeEntry ? `${nativeEntry.formatted} ${nativeEntry.symbol} native` : ""}
                    {nonZeroTokens.length > 0
                      ? ` · plus ${nonZeroTokens.length} token${nonZeroTokens.length === 1 ? "" : "s"} with a balance below.`
                      : "."}{" "}
                    {totalUsd !== null
                      ? `USD total covers ${pricedCount} priced asset${pricedCount === 1 ? "" : "s"} (CoinGecko); unpriced tokens are excluded, never guessed.`
                      : network?.testnet
                        ? "Testnet assets have no market price, so no USD total is shown."
                        : "USD prices are unavailable right now, so amounts are shown in token units."}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={source === "external" ? "secondary" : "default"}>
                    {source === "external" ? "External wallet" : "Built-in wallet"}
                  </Badge>
                  <CopyAddress address={address} />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-2">
                <Button asChild variant="gradient" className="flex-col gap-1 py-3 h-auto">
                  <Link href="/send">
                    <ArrowUpFromLine className="size-4" /> Send
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="flex-col gap-1 py-3 h-auto">
                  <Link href="/receive">
                    <ArrowDownToLine className="size-4" /> Receive
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="flex-col gap-1 py-3 h-auto">
                  <Link href="/swap">
                    <ArrowLeftRight className="size-4" /> Swap
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Tokens</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/assets">View all</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {balancesLoading ? (
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : tokenEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No tokens tracked on this network yet. Add them on the Assets page.
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {tokenEntries.slice(0, 5).map((e) => (
                      <li key={e.token?.address}>
                        <Link
                          href={`/token/${e.token?.address}`}
                          className="flex items-center justify-between py-2.5 text-sm transition-colors hover:text-primary"
                        >
                          <span className="font-medium">
                            {e.name} <span className="text-muted-foreground">({e.symbol})</span>
                          </span>
                          <span className="text-right">
                            <span className="block font-mono font-semibold">{e.formatted}</span>
                            {(() => {
                              const usd = usdValue(e.balance, e.decimals, priceFor(e.token?.address ?? null));
                              return usd !== null ? (
                                <span className="block text-xs text-muted-foreground">{formatUsd(usd)}</span>
                              ) : null;
                            })()}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Recent activity</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/activity">View all</Link>
                </Button>
              </CardHeader>
              <CardContent>
                <ActivityList
                  txs={activityTxs.slice(0, 5)}
                  network={network}
                  emptyMessage="No transactions on this network yet."
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
