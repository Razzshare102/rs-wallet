"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, Check, Copy, ExternalLink, EyeOff, Trash2 } from "lucide-react";
import { isAddress, type Address } from "viem";
import { PageHeader } from "@/components/layout/ModulePlaceholder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useRsChain } from "@/components/wallet/ChainProvider";
import { useBalances } from "@/hooks/useBalances";
import { useTokenList } from "@/hooks/useTokenList";
import { useActivity } from "@/hooks/useActivity";
import { usePrices } from "@/hooks/usePrices";
import { ActivityList } from "@/components/wallet/ActivityList";
import { usdValue } from "@/lib/prices";
import { interceptExternalLink } from "@/lib/telegram";
import { formatUsd } from "@/lib/utils";
import { explorerAddressUrlFor } from "@/lib/chains";

export default function TokenDetailsPage({
  params,
}: {
  params: Promise<{ contract: string }>;
}) {
  const { contract } = use(params);
  const { address, isConnected } = useActiveAccount();
  const { network, chainId } = useRsChain();
  const { entries, isLoading } = useBalances(address, network);
  const { hide, removeCustom } = useTokenList(chainId);
  const { txs: activityTxs } = useActivity(address, network);
  const [copied, setCopied] = useState(false);

  const isNative = contract.toLowerCase() === "native";
  const validContract = isNative || isAddress(contract);
  const entry = entries.find((e) =>
    isNative ? e.kind === "native" : e.token?.address.toLowerCase() === contract.toLowerCase(),
  );
  const tokenAddress = !isNative && validContract ? (contract as Address) : null;
  const explorerUrl =
    network && tokenAddress ? explorerAddressUrlFor(network, tokenAddress) : null;
  const tokenTxs = activityTxs.filter((t) =>
    isNative
      ? t.tokenAddress === null
      : t.tokenAddress?.toLowerCase() === contract.toLowerCase(),
  );
  const { priceFor } = usePrices(chainId, tokenAddress ? [tokenAddress] : []);
  const unitPrice = priceFor(tokenAddress);
  const balanceUsd = entry ? usdValue(entry.balance, entry.decimals, unitPrice) : null;

  if (!validContract) {
    return (
      <div>
        <PageHeader title="Token details" />
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            That is not a valid token contract address.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={entry?.name ?? (isNative ? network?.nativeName ?? "Native token" : "Token")}
        subtitle={network ? `On ${network.name}` : undefined}
      />

      <div className="flex flex-col gap-4">
        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Your balance
                </p>
                {isLoading ? (
                  <Skeleton className="mt-2 h-9 w-48" />
                ) : (
                  <p className="mt-2 text-3xl font-bold tracking-tight">
                    {entry ? `${entry.formatted} ${entry.symbol}` : "—"}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {!isConnected
                    ? "Connect or unlock a wallet to see your balance."
                    : balanceUsd !== null
                      ? `≈ ${formatUsd(balanceUsd)} at ${formatUsd(unitPrice)} per ${entry?.symbol} (CoinGecko).`
                      : network?.testnet
                        ? "Read directly from the chain. Testnet assets have no market price."
                        : "Read directly from the chain. No USD price is available for this token."}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {entry?.token ? (
                  entry.token.verified ? (
                    <Badge variant="secondary">Verified registry token</Badge>
                  ) : (
                    <Badge variant="warning">Custom · Unverified</Badge>
                  )
                ) : (
                  <Badge variant="secondary">Native token</Badge>
                )}
                {entry && <Badge variant="outline">{entry.decimals} decimals</Badge>}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2">
              <Button asChild variant="gradient" className="h-auto flex-col gap-1 py-3">
                <Link href={isNative ? "/send?token=native" : `/send?token=${contract}`}>
                  <ArrowUpFromLine className="size-4" /> Send
                </Link>
              </Button>
              <Button asChild variant="secondary" className="h-auto flex-col gap-1 py-3">
                <Link href="/receive">
                  <ArrowDownToLine className="size-4" /> Receive
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Symbol</span>
              <span className="font-medium">{entry?.symbol ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Network</span>
              <span className="font-medium">{network?.name ?? `Chain ${chainId}`}</span>
            </div>
            {!isNative && tokenAddress && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-muted-foreground">Contract</span>
                <span className="flex items-center gap-1.5">
                  <span className="break-all font-mono text-xs">{tokenAddress}</span>
                  <button
                    type="button"
                    className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                    aria-label="Copy contract address"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(tokenAddress);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      } catch {
                        /* ignore */
                      }
                    }}
                  >
                    {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                  </button>
                  {explorerUrl && (
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        if (interceptExternalLink(explorerUrl)) e.preventDefault();
                      }}
                      className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                      aria-label="View contract on block explorer"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </span>
              </div>
            )}
            {isNative && (
              <p className="leading-relaxed text-muted-foreground">
                This is the network&apos;s native gas token. It has no contract address.
              </p>
            )}
            {entry?.token && !entry.token.verified && (
              <p className="rounded-xl border border-warning/40 bg-warning/10 p-3 leading-relaxed text-muted-foreground">
                This is a custom token you added. Anyone can deploy a token with any name or symbol —
                always verify the contract address against the issuer or a block explorer before
                trusting it.
              </p>
            )}
          </CardContent>
        </Card>

        {entry?.kind === "erc20" && entry.token && (
          <Card>
            <CardContent className="flex flex-wrap gap-2 p-5">
              <Button variant="secondary" size="sm" onClick={() => hide(entry.token!.address)}>
                <EyeOff className="size-4" /> Hide token
              </Button>
              {!entry.token.verified && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeCustom(entry.token!.address)}
                >
                  <Trash2 className="size-4" /> Remove custom token
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity for this token</CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-2">
            <ActivityList
              txs={tokenTxs.slice(0, 10)}
              network={network}
              emptyMessage="No transactions with this token on this network yet."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
