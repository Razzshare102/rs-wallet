"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownUp,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUnits, parseUnits, type Address, type Hash } from "viem";
import { useSendTransaction, useWriteContract } from "wagmi";
import { PageHeader } from "@/components/layout/ModulePlaceholder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useRsChain } from "@/components/wallet/ChainProvider";
import { useBalances, trimNumber } from "@/hooks/useBalances";
import { useTokenList } from "@/hooks/useTokenList";
import { useVault } from "@/components/wallet/VaultProvider";
import { ERC20_ABI, getPublicClient } from "@/lib/publicClient";
import { builtinWalletClient, humanizeError } from "@/lib/signing";
import { addTx } from "@/lib/activity";
import { explorerTxUrlFor } from "@/lib/chains";
import { minReceived, SLIPPAGE_OPTIONS, type SwapQuote } from "@/lib/swap";
import { shortenAddress } from "@/lib/utils";

interface SwapToken {
  key: string;
  /** Null = native gas token. */
  address: Address | null;
  symbol: string;
  name: string;
  decimals: number;
}

interface QuoteState {
  quote: SwapQuote | null;
  notConfigured: boolean;
  message: string | null;
}

export default function SwapPage() {
  const { address: taker, source, isConnected } = useActiveAccount();
  const { network, chainId } = useRsChain();
  const vault = useVault();
  const queryClient = useQueryClient();
  const { tokens } = useTokenList(chainId);
  const { entries } = useBalances(taker, network);
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  const swapTokens: SwapToken[] = useMemo(() => {
    if (!network) return [];
    return [
      {
        key: "native",
        address: null,
        symbol: network.nativeSymbol,
        name: network.nativeName,
        decimals: network.nativeDecimals,
      },
      ...tokens.map((t) => ({
        key: t.address.toLowerCase(),
        address: t.address,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
      })),
    ];
  }, [network, tokens]);

  const [sellKey, setSellKey] = useState("native");
  const [buyKey, setBuyKey] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(50);
  const [step, setStep] = useState<"form" | "review" | "sending" | "sent">("form");
  const [approving, setApproving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sentHash, setSentHash] = useState<Hash | null>(null);

  const sell = swapTokens.find((t) => t.key === sellKey) ?? swapTokens[0];
  const buy =
    swapTokens.find((t) => t.key === buyKey) ??
    swapTokens.find((t) => t.key !== sellKey) ??
    swapTokens[0];

  const balanceOf = (token: SwapToken | undefined): string => {
    if (!token) return "—";
    const entry = entries.find((e) =>
      token.address === null
        ? e.kind === "native"
        : e.token?.address.toLowerCase() === token.address.toLowerCase(),
    );
    return entry?.formatted ?? "—";
  };

  const sellAmountWei = useMemo(() => {
    if (!sell || !amount.trim()) return null;
    try {
      const v = parseUnits(amount.trim(), sell.decimals);
      return v > 0n ? v : null;
    } catch {
      return null;
    }
  }, [amount, sell]);

  const sellEntry = entries.find((e) =>
    sell?.address === null
      ? e.kind === "native"
      : e.token?.address.toLowerCase() === sell?.address?.toLowerCase(),
  );
  const exceedsBalance = Boolean(
    sellEntry && sellAmountWei !== null && sellAmountWei > sellEntry.balance,
  );

  const quoteQuery = useQuery({
    queryKey: [
      "swap-quote",
      chainId,
      sell?.key,
      buy?.key,
      sellAmountWei?.toString(),
      taker,
      slippageBps,
    ],
    enabled: Boolean(
      network && taker && sell && buy && sell.key !== buy.key && sellAmountWei && !exceedsBalance,
    ),
    staleTime: 15_000,
    refetchInterval: 20_000,
    queryFn: async (): Promise<QuoteState> => {
      const params = new URLSearchParams({
        chainId: String(chainId),
        sellToken: sell!.address ?? "native",
        buyToken: buy!.address ?? "native",
        sellAmount: sellAmountWei!.toString(),
        taker: taker!,
        slippageBps: String(slippageBps),
      });
      const res = await fetch(`/api/swap/quote?${params}`);
      const data = (await res.json().catch(() => null)) as {
        quote?: SwapQuote;
        error?: string;
        message?: string;
      } | null;
      if (data?.error === "not_configured") {
        return { quote: null, notConfigured: true, message: data.message ?? null };
      }
      if (!res.ok || !data?.quote) {
        return {
          quote: null,
          notConfigured: false,
          message: data?.message ?? "No quote available for this pair and amount.",
        };
      }
      return { quote: data.quote, notConfigured: false, message: null };
    },
  });

  const quote = quoteQuery.data?.quote ?? null;
  const notConfigured = quoteQuery.data?.notConfigured ?? false;

  const buyFormatted = quote && buy ? trimNumber(formatUnits(BigInt(quote.buyAmount), buy.decimals)) : null;
  const minReceivedFormatted =
    quote && buy
      ? trimNumber(formatUnits(minReceived(quote.buyAmount, slippageBps), buy.decimals))
      : null;
  const rate =
    quote && sell && buy && sellAmountWei
      ? Number(formatUnits(BigInt(quote.buyAmount), buy.decimals)) /
        Number(formatUnits(sellAmountWei, sell.decimals))
      : null;

  const allowanceActual = quote?.allowanceActual ? BigInt(quote.allowanceActual) : null;
  const needsApproval = Boolean(
    sell?.address &&
      quote?.allowanceSpender &&
      allowanceActual !== null &&
      sellAmountWei !== null &&
      allowanceActual < sellAmountWei,
  );

  const flip = () => {
    if (!buy) return;
    setSellKey(buy.key);
    setBuyKey(sell?.key ?? null);
    setStep("form");
  };

  const signAndSend = async (
    send: (signer: "builtin" | "external") => Promise<Hash>,
  ): Promise<Hash> => {
    if (source === "builtin") return send("builtin");
    return send("external");
  };

  const doApprove = async () => {
    if (!taker || !network || !sell?.address || !quote?.allowanceSpender || !sellAmountWei) return;
    setApproving(true);
    setActionError(null);
    try {
      const spender = quote.allowanceSpender;
      const tokenAddress = sell.address;
      const hash = await signAndSend(async (signer) => {
        if (signer === "builtin") {
          const local = vault.activeAccount ? vault.getLocalAccount(vault.activeAccount.id) : null;
          if (!local) throw new Error("Built-in wallet is locked. Unlock it to approve.");
          const client = builtinWalletClient(local, network);
          return client.writeContract({
            account: local,
            chain: network.chain,
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [spender, sellAmountWei],
          });
        }
        return writeContractAsync({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [spender, sellAmountWei],
          chainId,
        });
      });
      addTx(taker, {
        hash,
        chainId,
        from: taker,
        to: tokenAddress,
        amount: amount.trim(),
        symbol: sell.symbol,
        tokenAddress,
        kind: "approve",
        status: "pending",
        timestamp: Date.now(),
      });
      // Wait for the approval to mine so the refreshed quote sees it.
      await getPublicClient(network)
        .waitForTransactionReceipt({ hash, timeout: 120_000 })
        .catch(() => undefined);
      await quoteQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ["balances"] });
    } catch (err) {
      setActionError(humanizeError(err));
    } finally {
      setApproving(false);
    }
  };

  const doSwap = async () => {
    if (!taker || !network || !sell || !buy || !quote) return;
    setStep("sending");
    setActionError(null);
    try {
      const tx = quote.transaction;
      const value = BigInt(tx.value || "0");
      const hash = await signAndSend(async (signer) => {
        if (signer === "builtin") {
          const local = vault.activeAccount ? vault.getLocalAccount(vault.activeAccount.id) : null;
          if (!local) throw new Error("Built-in wallet is locked. Unlock it to swap.");
          const client = builtinWalletClient(local, network);
          return client.sendTransaction({
            account: local,
            chain: network.chain,
            to: tx.to,
            data: tx.data,
            value,
          });
        }
        return sendTransactionAsync({ to: tx.to, data: tx.data, value, chainId });
      });
      addTx(taker, {
        hash,
        chainId,
        from: taker,
        to: tx.to,
        amount: amount.trim(),
        symbol: sell.symbol,
        tokenAddress: sell.address,
        kind: "swap",
        status: "pending",
        timestamp: Date.now(),
      });
      setSentHash(hash);
      setStep("sent");
      void queryClient.invalidateQueries({ queryKey: ["balances"] });
    } catch (err) {
      setActionError(humanizeError(err));
      setStep("review");
    }
  };

  if (!isConnected || !taker) {
    return (
      <div>
        <PageHeader title="Swap" subtitle="Aggregator quotes with approval safety checks and slippage control." />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              No active account. Unlock the built-in wallet to swap.
            </p>
            <div className="flex gap-2">
              <Button asChild variant="gradient">
                <Link href="/unlock">Unlock wallet</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!network) {
    return (
      <div>
        <PageHeader title="Swap" subtitle="Aggregator quotes with approval safety checks and slippage control." />
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            The active chain ({chainId}) is not supported. Switch networks from the header.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "sent" && sentHash) {
    const url = explorerTxUrlFor(network, sentHash);
    return (
      <div>
        <PageHeader title="Swap" subtitle="Aggregator quotes with approval safety checks and slippage control." />
        <Card className="glass">
          <CardContent className="flex flex-col items-center p-10 text-center">
            <CheckCircle2 className="size-12 text-success" />
            <h2 className="mt-4 text-lg font-semibold">Swap broadcast</h2>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
              Swapping {amount} {sell?.symbol} for {buy?.symbol} on {network.name}. Track it in
              Activity — the received amount settles when the transaction confirms.
            </p>
            <p className="mt-3 break-all font-mono text-xs text-muted-foreground">{sentHash}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {url && (
                <Button asChild variant="secondary">
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4" /> View on explorer
                  </a>
                </Button>
              )}
              <Button asChild variant="gradient">
                <Link href="/activity">Open Activity</Link>
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setStep("form");
                  setAmount("");
                  setSentHash(null);
                }}
              >
                New swap
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Swap"
        subtitle={`Quotes from the 0x aggregator on ${network.name}. Nothing is signed until you confirm.`}
      />

      {notConfigured ? (
        <Card className="border-warning/40">
          <CardContent className="flex flex-col gap-3 p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <TriangleAlert className="size-5 text-warning" /> Swap is not configured yet
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {quoteQuery.data?.message ??
                "This deployment has no 0x API key, so swaps are disabled rather than faked."}
            </p>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
              <li>
                Create a free API key at <span className="font-medium text-foreground">dashboard.0x.org</span>
              </li>
              <li>
                Set the server environment variable{" "}
                <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">ZEROX_API_KEY</code>{" "}
                (never a NEXT_PUBLIC variable)
              </li>
              <li>Redeploy — quotes, approvals and swapping will activate automatically</li>
            </ol>
            <p className="text-xs text-muted-foreground">
              Tip: enter an amount above first — the configuration check runs when a quote is
              requested.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="swap-sell">You sell</Label>
            <div className="flex gap-2">
              <select
                id="swap-sell"
                value={sell?.key}
                onChange={(e) => {
                  setSellKey(e.target.value);
                  setStep("form");
                }}
                className="h-11 w-36 shrink-0 rounded-xl border border-input bg-card/60 px-3 text-sm font-medium outline-none focus:border-ring"
              >
                {swapTokens.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.symbol}
                  </option>
                ))}
              </select>
              <Input
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value.replace(/[^0-9.]/g, ""));
                  setStep("form");
                }}
                placeholder="0.0"
                inputMode="decimal"
                className="font-mono"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Balance: {balanceOf(sell)} {sell?.symbol}
              {exceedsBalance && (
                <span className="font-medium text-destructive"> · Amount exceeds your balance.</span>
              )}
            </p>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={flip}
              className="rounded-full border border-border bg-secondary p-2 text-secondary-foreground transition-colors hover:bg-secondary/70"
              aria-label="Flip sell and buy tokens"
            >
              <ArrowDownUp className="size-4" />
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="swap-buy">You receive (estimated)</Label>
            <div className="flex gap-2">
              <select
                id="swap-buy"
                value={buy?.key}
                onChange={(e) => {
                  setBuyKey(e.target.value);
                  setStep("form");
                }}
                className="h-11 w-36 shrink-0 rounded-xl border border-input bg-card/60 px-3 text-sm font-medium outline-none focus:border-ring"
              >
                {swapTokens
                  .filter((t) => t.key !== sell?.key)
                  .map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.symbol}
                    </option>
                  ))}
              </select>
              <div className="flex h-11 flex-1 items-center rounded-xl border border-input bg-card/40 px-3 font-mono text-sm">
                {quoteQuery.isFetching && !buyFormatted ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  (buyFormatted ?? "0.0")
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Balance: {balanceOf(buy)} {buy?.symbol}</p>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Max slippage</Label>
            <div className="flex gap-2">
              {SLIPPAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.bps}
                  type="button"
                  onClick={() => setSlippageBps(opt.bps)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    slippageBps === opt.bps
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/60 p-4 text-sm">
            {sell?.key === buy?.key ? (
              <p className="text-muted-foreground">Choose two different tokens to get a quote.</p>
            ) : !sellAmountWei ? (
              <p className="text-muted-foreground">Enter an amount to get a live quote.</p>
            ) : quoteQuery.isFetching && !quote ? (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Fetching the best quote…
              </p>
            ) : quote ? (
              <dl className="flex flex-col gap-2">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Rate</dt>
                  <dd className="font-medium">
                    1 {sell?.symbol} ≈ {rate ? trimNumber(String(rate)) : "—"} {buy?.symbol}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Minimum received</dt>
                  <dd className="font-medium">
                    {minReceivedFormatted} {buy?.symbol}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Network fee (est.)</dt>
                  <dd className="font-medium">
                    {quote.estimatedGasUsd ? `$${trimNumber(quote.estimatedGasUsd)}` : "—"}
                    {quote.transaction.gas ? ` · ${Number(quote.transaction.gas).toLocaleString()} gas` : ""}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Route contract</dt>
                  <dd className="font-mono text-xs">{shortenAddress(quote.transaction.to, 6)}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-destructive">
                {quoteQuery.data?.message ?? "No quote available for this pair and amount."}
              </p>
            )}
          </div>

          {actionError && <p className="text-sm font-medium text-destructive">{actionError}</p>}

          {step === "form" &&
            (needsApproval ? (
              <div className="flex flex-col gap-2">
                <Button variant="gradient" size="lg" onClick={doApprove} disabled={approving}>
                  {approving ? <Loader2 className="size-4 animate-spin" /> : null}
                  Approve exactly {amount} {sell?.symbol}
                </Button>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  RS WALLET only ever requests an <span className="font-medium text-foreground">exact-amount</span>{" "}
                  approval for this swap — never an unlimited one. The approval is a separate
                  transaction you sign first; the swap follows after it confirms.
                </p>
              </div>
            ) : (
              <Button
                variant="gradient"
                size="lg"
                disabled={!quote || exceedsBalance}
                onClick={() => setStep("review")}
              >
                Review swap <ArrowRight className="size-4" />
              </Button>
            ))}
        </CardContent>
      </Card>

      {step === "review" || step === "sending" ? (
        <Card className="mt-4 border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="size-5 text-primary" /> Confirm before signing
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <dl className="flex flex-col gap-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">You sell</dt>
                <dd className="font-mono font-semibold">
                  {amount} {sell?.symbol}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">You receive (est.)</dt>
                <dd className="font-mono font-semibold">
                  {buyFormatted} {buy?.symbol}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Minimum received</dt>
                <dd className="font-medium">
                  {minReceivedFormatted} {buy?.symbol} ({slippageBps / 100}% slippage)
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Network</dt>
                <dd className="font-medium">{network.name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Signing with</dt>
                <dd className="font-medium">
                  {source === "builtin"
                    ? "Built-in wallet (this device)"
                    : "External wallet — you will confirm in your wallet app"}
                </dd>
              </div>
            </dl>
            <p className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs leading-relaxed text-muted-foreground">
              Quotes refresh every 20 seconds and the final amount can differ slightly. If the
              price moves beyond your slippage limit, the swap reverts instead of filling at a bad
              price. Transactions cannot be reversed.
            </p>
            {actionError && <p className="text-sm font-medium text-destructive">{actionError}</p>}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep("form")} disabled={step === "sending"}>
                Back
              </Button>
              <Button variant="gradient" size="lg" className="flex-1" onClick={doSwap} disabled={step === "sending"}>
                {step === "sending" ? <Loader2 className="size-4 animate-spin" /> : null}
                {source === "builtin" ? "Confirm & swap" : "Confirm — sign in wallet"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">0x aggregator</Badge>
        Quotes are live from 0x across its liquidity sources on this network. RS WALLET adds no
        fee on top.
      </p>
    </div>
  );
}
