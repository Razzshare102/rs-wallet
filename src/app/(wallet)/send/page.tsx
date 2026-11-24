"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  formatUnits,
  isAddress,
  parseUnits,
  type Address,
  type Hash,
} from "viem";
import { useSendTransaction, useWriteContract } from "wagmi";
import { PageHeader } from "@/components/layout/ModulePlaceholder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useRsChain } from "@/components/wallet/ChainProvider";
import { interceptExternalLink } from "@/lib/telegram";
import { useBalances, trimNumber } from "@/hooks/useBalances";
import { useVault } from "@/components/wallet/VaultProvider";
import { ERC20_ABI, getPublicClient } from "@/lib/publicClient";
import { builtinWalletClient, humanizeError } from "@/lib/signing";
import { addTx } from "@/lib/activity";
import { explorerTxUrlFor } from "@/lib/chains";
import { shortenAddress } from "@/lib/utils";

interface GasEstimate {
  gas: bigint;
  maxFeePerGas: bigint;
  fee: bigint;
}

function SendForm() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { address: from, source, isConnected } = useActiveAccount();
  const { network, chainId } = useRsChain();
  const vault = useVault();
  const { entries } = useBalances(from, network);
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  const initialToken = searchParams.get("token") ?? "native";
  const [selectedKey, setSelectedKey] = useState<string>(
    initialToken === "native" ? "native" : initialToken.toLowerCase(),
  );
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"form" | "review" | "sending" | "sent">("form");
  const [sendError, setSendError] = useState<string | null>(null);
  const [sentHash, setSentHash] = useState<Hash | null>(null);

  const entry = useMemo(() => {
    const found = entries.find((e) =>
      e.kind === "native" ? selectedKey === "native" : e.token?.address.toLowerCase() === selectedKey,
    );
    return found ?? entries[0];
  }, [entries, selectedKey]);

  const recipientValid = isAddress(recipient.trim());
  const recipientAddr = recipientValid ? (recipient.trim() as Address) : null;
  const isSelf = Boolean(from && recipientAddr && from.toLowerCase() === recipientAddr.toLowerCase());
  const looksLikeEns = recipient.includes(".") && !recipientValid;

  const amountWei = useMemo(() => {
    if (!entry || !amount.trim()) return null;
    try {
      return parseUnits(amount.trim(), entry.decimals);
    } catch {
      return null;
    }
  }, [amount, entry]);

  const amountValid = amountWei !== null && amountWei > 0n;
  const exceedsBalance = Boolean(entry && amountWei !== null && amountWei > entry.balance);

  // Is the recipient a contract? (warning only — sending to contracts can be legitimate)
  const { data: recipientIsContract } = useQuery({
    queryKey: ["recipient-code", chainId, recipientAddr],
    enabled: Boolean(network && recipientAddr),
    queryFn: async () => {
      if (!network || !recipientAddr) return false;
      const code = await getPublicClient(network).getCode({ address: recipientAddr });
      return Boolean(code && code !== "0x");
    },
  });

  // Gas estimation — live from the network for the exact transaction.
  const estimate = useQuery({
    queryKey: [
      "gas-estimate",
      chainId,
      from,
      recipientAddr,
      entry?.kind,
      entry?.token?.address,
      amountWei?.toString(),
    ],
    enabled: Boolean(network && from && recipientAddr && amountValid && entry),
    queryFn: async (): Promise<GasEstimate> => {
      const client = getPublicClient(network!);
      const fees = await client.estimateFeesPerGas();
      const maxFeePerGas = fees.maxFeePerGas;
      let gas: bigint;
      if (entry!.kind === "native") {
        gas = await client.estimateGas({
          account: from!,
          to: recipientAddr!,
          value: amountWei!,
        });
      } else {
        gas = await client.estimateContractGas({
          address: entry!.token!.address,
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [recipientAddr!, amountWei!],
          account: from!,
        });
      }
      return { gas, maxFeePerGas, fee: gas * maxFeePerGas };
    },
  });

  const feeFormatted = estimate.data
    ? trimNumber(formatUnits(estimate.data.fee, network?.nativeDecimals ?? 18))
    : null;

  const nativeEntry = entries.find((e) => e.kind === "native");
  const insufficientForFee = Boolean(
    entry &&
      nativeEntry &&
      estimate.data &&
      (entry.kind === "native"
        ? amountWei !== null && amountWei + estimate.data.fee > nativeEntry.balance
        : nativeEntry.balance < estimate.data.fee),
  );

  const canReview =
    Boolean(from && network && entry) &&
    recipientValid &&
    amountValid &&
    !exceedsBalance &&
    !insufficientForFee &&
    !estimate.isError;

  const setMax = () => {
    if (!entry) return;
    if (entry.kind === "native" && estimate.data) {
      const max = entry.balance > estimate.data.fee ? entry.balance - estimate.data.fee : 0n;
      setAmount(formatUnits(max, entry.decimals));
    } else {
      setAmount(formatUnits(entry.balance, entry.decimals));
    }
  };

  const doSend = async () => {
    if (!from || !network || !entry || !recipientAddr || amountWei === null) return;
    setStep("sending");
    setSendError(null);
    try {
      let hash: Hash;
      if (source === "builtin") {
        const local = vault.activeAccount ? vault.getLocalAccount(vault.activeAccount.id) : null;
        if (!local) throw new Error("Built-in wallet is locked. Unlock it to send.");
        const client = builtinWalletClient(local, network);
        if (entry.kind === "native") {
          hash = await client.sendTransaction({
            account: local,
            chain: network.chain,
            to: recipientAddr,
            value: amountWei,
          });
        } else {
          hash = await client.writeContract({
            account: local,
            chain: network.chain,
            address: entry.token!.address,
            abi: ERC20_ABI,
            functionName: "transfer",
            args: [recipientAddr, amountWei],
          });
        }
      } else {
        if (entry.kind === "native") {
          hash = await sendTransactionAsync({ to: recipientAddr, value: amountWei, chainId });
        } else {
          hash = await writeContractAsync({
            address: entry.token!.address,
            abi: ERC20_ABI,
            functionName: "transfer",
            args: [recipientAddr, amountWei],
            chainId,
          });
        }
      }
      addTx(from, {
        hash,
        chainId,
        from,
        to: recipientAddr,
        amount: amount.trim(),
        symbol: entry.symbol,
        tokenAddress: entry.kind === "native" ? null : entry.token!.address,
        kind: "send",
        status: "pending",
        // eslint-disable-next-line react-hooks/purity -- Date.now() inside the send handler, not during render
        timestamp: Date.now(),
      });
      setSentHash(hash);
      setStep("sent");
      void queryClient.invalidateQueries({ queryKey: ["balances"] });
    } catch (err) {
      setSendError(humanizeError(err));
      setStep("review");
    }
  };

  if (!isConnected || !from) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            No active account. Unlock the built-in wallet to send.
          </p>
          <div className="flex gap-2">
            <Button asChild variant="gradient">
              <Link href="/unlock">Unlock wallet</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!network) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          The active chain ({chainId}) is not supported. Switch networks from the header.
        </CardContent>
      </Card>
    );
  }

  if (step === "sent" && sentHash) {
    const url = explorerTxUrlFor(network, sentHash);
    return (
      <Card className="glass">
        <CardContent className="flex flex-col items-center p-10 text-center">
          <CheckCircle2 className="size-12 text-success" />
          <h2 className="mt-4 text-lg font-semibold">Transaction broadcast</h2>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
            {amount} {entry?.symbol} is on its way to {shortenAddress(recipientAddr ?? "")} on{" "}
            {network.name}. It will confirm shortly — track it in Activity.
          </p>
          <p className="mt-3 break-all font-mono text-xs text-muted-foreground">{sentHash}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {url && (
              <Button asChild variant="secondary">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (interceptExternalLink(url)) e.preventDefault();
                  }}
                >
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
                setRecipient("");
                setSentHash(null);
              }}
            >
              Send another
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
              From{" "}
              <span className="font-mono text-foreground">{shortenAddress(from, 6)}</span>{" "}
              <Badge variant={source === "builtin" ? "default" : "secondary"}>
                {source === "builtin" ? "Built-in" : "External"}
              </Badge>
            </span>
            <Badge variant="outline">{network.name}</Badge>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="send-token">Token</Label>
            <select
              id="send-token"
              value={entry?.kind === "native" ? "native" : entry?.token?.address.toLowerCase()}
              onChange={(e) => setSelectedKey(e.target.value)}
              className="h-11 w-full rounded-xl border border-input bg-card/60 px-3 text-sm font-medium outline-none focus:border-ring"
            >
              {entries.map((e) => (
                <option
                  key={e.kind === "native" ? "native" : e.token?.address}
                  value={e.kind === "native" ? "native" : e.token?.address.toLowerCase()}
                >
                  {e.symbol} — balance {e.formatted}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="send-to">Recipient address</Label>
            <Input
              id="send-to"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x…"
              className="font-mono text-[13px]"
              spellCheck={false}
              autoComplete="off"
            />
            {recipient.trim() && !recipientValid && (
              <p className="text-xs font-medium text-destructive">
                {looksLikeEns
                  ? "That looks like an ENS name — ENS resolution is not supported in this version. Paste the 0x address instead."
                  : "That is not a valid EVM address."}
              </p>
            )}
            {isSelf && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
                <TriangleAlert className="size-3.5" /> This is your own address — you would be sending
                to yourself.
              </p>
            )}
            {recipientIsContract && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
                <TriangleAlert className="size-3.5" /> This address is a smart contract. Sending tokens
                to a contract that cannot handle them can lose them permanently.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="send-amount">Amount</Label>
              <button
                type="button"
                onClick={setMax}
                className="text-xs font-semibold text-primary hover:underline"
              >
                MAX
              </button>
            </div>
            <div className="relative">
              <Input
                id="send-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.0"
                inputMode="decimal"
                className="pr-16 font-mono"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                {entry?.symbol}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Balance: {entry?.formatted ?? "—"} {entry?.symbol}
              {exceedsBalance && (
                <span className="font-medium text-destructive"> · Amount exceeds your balance.</span>
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card/60 p-4 text-sm">
            <p className="flex items-center justify-between">
              <span className="text-muted-foreground">Estimated network fee</span>
              <span className="font-medium">
                {estimate.isFetching ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : estimate.isError ? (
                  <span className="text-destructive">Estimation failed</span>
                ) : feeFormatted ? (
                  `~${feeFormatted} ${network.nativeSymbol}`
                ) : (
                  "—"
                )}
              </span>
            </p>
            {estimate.data && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Gas limit {estimate.data.gas.toLocaleString()} · max fee{" "}
                {trimNumber(formatUnits(estimate.data.maxFeePerGas, 9), 2)} Gwei. The actual fee is
                usually lower than this maximum estimate.
              </p>
            )}
            {estimate.isError && (
              <p className="mt-1.5 text-xs text-destructive">
                The network could not estimate this transaction — it may revert (for example,
                insufficient balance). Review the details before continuing.
              </p>
            )}
            {insufficientForFee && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
                <TriangleAlert className="size-3.5" /> Not enough {network.nativeSymbol} to cover the
                amount plus the network fee.
              </p>
            )}
          </div>

          {step === "form" && (
            <Button
              variant="gradient"
              size="lg"
              disabled={!canReview}
              onClick={() => setStep("review")}
            >
              Review transaction <ArrowRight className="size-4" />
            </Button>
          )}
        </CardContent>
      </Card>

      {step === "review" || step === "sending" ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="size-5 text-primary" /> Confirm before signing
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <dl className="flex flex-col gap-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="font-mono font-semibold">
                  {amount} {entry?.symbol}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">To</dt>
                <dd className="break-all text-right font-mono text-xs leading-5">{recipientAddr}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">From</dt>
                <dd className="font-mono text-xs">{from}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Network</dt>
                <dd className="font-medium">{network.name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Estimated fee (max)</dt>
                <dd className="font-medium">
                  {feeFormatted ? `~${feeFormatted} ${network.nativeSymbol}` : "—"}
                </dd>
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
              Transactions cannot be reversed. Double-check the recipient address and network —
              sending on the wrong network can lose funds.
            </p>
            {sendError && <p className="text-sm font-medium text-destructive">{sendError}</p>}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep("form")} disabled={step === "sending"}>
                Back
              </Button>
              <Button variant="gradient" size="lg" className="flex-1" onClick={doSend} disabled={step === "sending"}>
                {step === "sending" ? <Loader2 className="size-4 animate-spin" /> : null}
                {source === "builtin" ? "Confirm & send" : "Confirm — sign in wallet"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default function SendPage() {
  return (
    <div>
      <PageHeader title="Send" subtitle="Real transactions on the active network. Nothing is signed until you confirm." />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <SendForm />
      </Suspense>
    </div>
  );
}
