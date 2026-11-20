"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, EyeOff, Eye, Loader2, Plus, RefreshCw, TriangleAlert } from "lucide-react";
import type { Address } from "viem";
import { isAddress } from "viem";
import { PageHeader } from "@/components/layout/ModulePlaceholder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useRsChain } from "@/components/wallet/ChainProvider";
import { useBalances } from "@/hooks/useBalances";
import { usePrices } from "@/hooks/usePrices";
import { usdValue } from "@/lib/prices";
import { formatUsd } from "@/lib/utils";
import { useTokenList } from "@/hooks/useTokenList";
import { fetchTokenMetadata } from "@/lib/publicClient";
import { findRegistryToken, type TokenInfo } from "@/lib/tokens";
import { cn } from "@/lib/utils";

function TokenBadge({ token }: { token: TokenInfo | null }) {
  if (!token) return <Badge variant="secondary">Native</Badge>;
  if (token.verified) {
    return (
      <Badge variant="secondary" className="gap-1">
        <BadgeCheck className="size-3" /> Verified
      </Badge>
    );
  }
  return (
    <Badge variant="warning" className="gap-1">
      <TriangleAlert className="size-3" /> Custom · Unverified
    </Badge>
  );
}

function AddCustomToken() {
  const { network, chainId } = useRsChain();
  const { addCustom } = useTokenList(chainId);
  const [address, setAddress] = useState("");
  const [preview, setPreview] = useState<TokenInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchPreview = async () => {
    setError(null);
    setPreview(null);
    if (!network) return;
    const trimmed = address.trim();
    if (!isAddress(trimmed)) {
      setError("That is not a valid EVM address.");
      return;
    }
    if (findRegistryToken(chainId, trimmed)) {
      setError("That token is already in the verified registry for this network.");
      return;
    }
    setBusy(true);
    try {
      const meta = await fetchTokenMetadata(network, trimmed as Address);
      setPreview({
        address: trimmed as Address,
        name: meta.name,
        symbol: meta.symbol,
        decimals: meta.decimals,
        verified: false,
      });
    } catch {
      setError(
        "Could not read name/symbol/decimals from that contract — it may not be an ERC-20 token on this network, or the RPC is unavailable.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add custom token</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Paste an ERC-20 contract address on {network?.name ?? "the active network"}. RS WALLET reads
          its name, symbol and decimals from the contract itself. Custom tokens are always labelled
          unverified — anyone can deploy a token with a familiar name, so verify the contract address
          against the issuer or a block explorer.
        </p>
        <div className="flex flex-col gap-2">
          <Label htmlFor="custom-token-address">Contract address</Label>
          <div className="flex gap-2">
            <Input
              id="custom-token-address"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setPreview(null);
              }}
              placeholder="0x…"
              className="font-mono text-[13px]"
              spellCheck={false}
            />
            <Button variant="secondary" onClick={fetchPreview} disabled={!address.trim() || busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Fetch
            </Button>
          </div>
        </div>
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        {preview && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3">
            <div>
              <p className="font-medium">
                {preview.name} <span className="text-muted-foreground">({preview.symbol})</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {preview.decimals} decimals · {preview.address}
              </p>
            </div>
            <Button
              variant="gradient"
              size="sm"
              onClick={() => {
                addCustom(preview);
                setPreview(null);
                setAddress("");
              }}
            >
              <Plus className="size-4" /> Add token
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AssetsPage() {
  const { address, isConnected } = useActiveAccount();
  const { network, chainId } = useRsChain();
  const { entries, isLoading, isError, refetch, isFetching } = useBalances(address, network);
  const { hide, unhide, hiddenTokens } = useTokenList(chainId);
  const { priceFor } = usePrices(
    chainId,
    entries.filter((e) => e.kind === "erc20").map((e) => e.token!.address),
  );
  const [showHidden, setShowHidden] = useState(false);

  return (
    <div>
      <PageHeader
        title="Assets"
        subtitle={network ? `Balances on ${network.name}, read directly from the chain.` : "Balances for the active network."}
      />

      {!isConnected || !address ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              No active account. Create or unlock the built-in wallet, or connect an external wallet to
              see real balances.
            </p>
            <div className="flex gap-2">
              <Button asChild variant="gradient">
                <Link href="/create">Create wallet</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/unlock">Unlock</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : !network ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            The active chain ({chainId}) is not supported. Switch networks from the header.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Tokens</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={cn("size-4", isFetching && "animate-spin")} /> Refresh
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {isLoading && (
                <>
                  <Skeleton className="h-[68px] w-full rounded-2xl" />
                  <Skeleton className="h-[68px] w-full rounded-2xl" />
                  <Skeleton className="h-[68px] w-full rounded-2xl" />
                </>
              )}
              {isError && (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Could not load balances from the {network.name} RPC. It may be rate-limited — try
                    again, or set your own RPC endpoint in Networks/Settings.
                  </p>
                  <Button variant="secondary" size="sm" onClick={() => refetch()}>
                    Retry
                  </Button>
                </div>
              )}
              {!isLoading &&
                !isError &&
                entries.map((entry) => {
                  const href =
                    entry.kind === "native" ? "/token/native" : `/token/${entry.token?.address}`;
                  return (
                    <div
                      key={entry.kind === "native" ? "native" : entry.token?.address}
                      className="group flex items-center gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3.5 transition-colors hover:bg-secondary/60"
                    >
                      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-xs font-bold text-primary">
                          {entry.symbol.slice(0, 4)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2 font-medium">
                            {entry.name}
                            <TokenBadge token={entry.token} />
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">{entry.symbol}</span>
                        </span>
                        <span className="text-right">
                          <span className="block font-mono text-sm font-semibold">{entry.formatted}</span>
                          <span className="block text-xs text-muted-foreground">
                            {(() => {
                              const usd = usdValue(
                                entry.balance,
                                entry.decimals,
                                priceFor(entry.token?.address ?? null),
                              );
                              return usd !== null ? formatUsd(usd) : entry.symbol;
                            })()}
                          </span>
                        </span>
                      </Link>
                      {entry.kind === "erc20" && entry.token && (
                        <button
                          type="button"
                          onClick={() => hide(entry.token!.address)}
                          className="rounded-full p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                          title="Hide token"
                          aria-label={`Hide ${entry.symbol}`}
                        >
                          <EyeOff className="size-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              {!isLoading && !isError && entries.length <= 1 && (
                <p className="py-2 text-sm text-muted-foreground">
                  Only the native token is tracked on this network so far. Add tokens below — balances
                  appear as soon as the chain reports them.
                </p>
              )}
            </CardContent>
          </Card>

          <AddCustomToken />

          {hiddenTokens.length > 0 && (
            <Card>
              <CardHeader>
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => setShowHidden((s) => !s)}
                >
                  <CardTitle className="text-base">Hidden tokens ({hiddenTokens.length})</CardTitle>
                  <Eye className="size-4 text-muted-foreground" />
                </button>
              </CardHeader>
              {showHidden && (
                <CardContent className="flex flex-col gap-2">
                  {hiddenTokens.map((token) => (
                    <div
                      key={token.address}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3"
                    >
                      <p className="text-sm font-medium">
                        {token.name} <span className="text-muted-foreground">({token.symbol})</span>
                      </p>
                      <Button variant="secondary" size="sm" onClick={() => unhide(token.address)}>
                        Unhide
                      </Button>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
