"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, ShieldAlert, TriangleAlert } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUnits, isAddress, maxUint256, type Address, type Hash } from "viem";
import { useWriteContract } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useRsChain } from "@/components/wallet/ChainProvider";
import { useTokenList } from "@/hooks/useTokenList";
import { useVault } from "@/components/wallet/VaultProvider";
import { ERC20_ABI, getPublicClient } from "@/lib/publicClient";
import { builtinWalletClient, humanizeError } from "@/lib/signing";
import { addTx } from "@/lib/activity";
import { trimNumber } from "@/hooks/useBalances";
import { shortenAddress } from "@/lib/utils";

/**
 * ERC-20 approval manager (spec §9/§13).
 *
 * Pick one of your tokens, enter a spender contract, and the current
 * allowance is read directly from the chain. Revoking sends an
 * approve(spender, 0) transaction — signed only after an explicit
 * confirm step, like every other transaction in RS WALLET.
 * There is no backend list of "all your approvals": without an indexer
 * that cannot be enumerated honestly, so this tool checks the exact
 * token + spender pairs you care about.
 */
export function ApprovalManager() {
  const { address: owner, source, isConnected } = useActiveAccount();
  const { network, chainId } = useRsChain();
  const { tokens } = useTokenList(chainId);
  const vault = useVault();
  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();

  const [tokenKey, setTokenKey] = useState<string>("");
  const [spenderInput, setSpenderInput] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const token = useMemo(
    () => tokens.find((t) => t.address.toLowerCase() === tokenKey) ?? tokens[0],
    [tokens, tokenKey],
  );
  const spenderValid = isAddress(spenderInput.trim());
  const spender = spenderValid ? (spenderInput.trim() as Address) : null;

  const allowanceQuery = useQuery({
    queryKey: ["allowance", chainId, owner, token?.address, spender],
    enabled: Boolean(network && owner && token && spender),
    queryFn: async (): Promise<bigint> => {
      const client = getPublicClient(network!);
      return client.readContract({
        address: token!.address,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [owner!, spender!],
      });
    },
  });

  const allowance = allowanceQuery.data ?? null;
  const isUnlimited = allowance !== null && allowance >= maxUint256 / 2n;
  const hasAllowance = allowance !== null && allowance > 0n;

  const doRevoke = async () => {
    if (!owner || !network || !token || !spender) return;
    setRevoking(true);
    setError(null);
    try {
      let hash: Hash;
      if (source === "builtin") {
        const local = vault.activeAccount ? vault.getLocalAccount(vault.activeAccount.id) : null;
        if (!local) throw new Error("Built-in wallet is locked. Unlock it to revoke.");
        const client = builtinWalletClient(local, network);
        hash = await client.writeContract({
          account: local,
          chain: network.chain,
          address: token.address,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [spender, 0n],
        });
      } else {
        hash = await writeContractAsync({
          address: token.address,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [spender, 0n],
          chainId,
        });
      }
      addTx(owner, {
        hash,
        chainId,
        from: owner,
        to: token.address,
        amount: "0",
        symbol: token.symbol,
        tokenAddress: token.address,
        kind: "approve",
        status: "pending",
        // eslint-disable-next-line react-hooks/purity -- Date.now() inside the revoke handler, not during render
        timestamp: Date.now(),
      });
      setDone(hash);
      setConfirming(false);
      void queryClient.invalidateQueries({ queryKey: ["allowance"] });
    } catch (err) {
      setError(humanizeError(err));
    } finally {
      setRevoking(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="size-5 text-primary" /> Token approval manager
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          An allowance lets a contract spend your tokens. Check any token + spender pair against
          the live chain and revoke allowances you no longer trust. RS WALLET itself only ever
          requests exact-amount approvals for swaps.
        </p>

        {!isConnected || !owner ? (
          <p className="text-sm text-muted-foreground">
            Unlock the built-in wallet or <Link href="/" className="font-medium text-primary hover:underline">connect an external wallet</Link> to
            inspect approvals for your account.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="appr-token">Token</Label>
                <select
                  id="appr-token"
                  value={token?.address.toLowerCase()}
                  onChange={(e) => {
                    setTokenKey(e.target.value);
                    setDone(null);
                    setConfirming(false);
                  }}
                  className="h-11 w-full rounded-xl border border-input bg-card/60 px-3 text-sm font-medium outline-none focus:border-ring"
                >
                  {tokens.map((t) => (
                    <option key={t.address} value={t.address.toLowerCase()}>
                      {t.symbol} — {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="appr-spender">Spender contract</Label>
                <Input
                  id="appr-spender"
                  value={spenderInput}
                  onChange={(e) => {
                    setSpenderInput(e.target.value);
                    setDone(null);
                    setConfirming(false);
                  }}
                  placeholder="0x…"
                  className="font-mono text-[13px]"
                  spellCheck={false}
                  autoComplete="off"
                />
                {spenderInput.trim() && !spenderValid && (
                  <p className="text-xs font-medium text-destructive">That is not a valid EVM address.</p>
                )}
              </div>
            </div>

            {token && spender && (
              <div className="rounded-2xl border border-border bg-card/60 p-4 text-sm">
                {allowanceQuery.isLoading ? (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Reading allowance from {network?.name}…
                  </p>
                ) : allowanceQuery.isError ? (
                  <p className="text-destructive">Could not read the allowance from the network RPC. Try again.</p>
                ) : allowance !== null ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-muted-foreground">
                        Current allowance for {shortenAddress(spender, 6)}
                      </p>
                      <p className="mt-1 font-mono text-base font-semibold">
                        {isUnlimited
                          ? "Unlimited"
                          : `${trimNumber(formatUnits(allowance, token.decimals))} ${token.symbol}`}
                      </p>
                    </div>
                    {isUnlimited && (
                      <Badge variant="destructive" className="gap-1">
                        <TriangleAlert className="size-3" /> Unlimited approval
                      </Badge>
                    )}
                    {!hasAllowance && <Badge variant="success">No allowance</Badge>}
                  </div>
                ) : null}
              </div>
            )}

            {isUnlimited && (
              <p className="flex items-start gap-2 text-xs leading-relaxed text-warning">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                This spender can move your entire {token?.symbol} balance at any time. Revoking is
                strongly recommended unless you actively use it.
              </p>
            )}

            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            {done && (
              <p className="text-sm font-medium text-success">
                Revoke transaction broadcast — track it in Activity. The allowance reads 0 once it
                confirms.
              </p>
            )}

            {hasAllowance &&
              (confirming ? (
                <div className="flex flex-col gap-2 rounded-2xl border border-primary/40 p-4">
                  <p className="text-sm leading-relaxed">
                    Revoke by approving <span className="font-mono font-semibold">0 {token?.symbol}</span>{" "}
                    for spender <span className="font-mono text-xs">{spender}</span>? This is an
                    on-chain transaction and costs a small network fee.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setConfirming(false)} disabled={revoking}>
                      Cancel
                    </Button>
                    <Button variant="gradient" className="flex-1" onClick={doRevoke} disabled={revoking}>
                      {revoking ? <Loader2 className="size-4 animate-spin" /> : null}
                      {source === "builtin" ? "Confirm & revoke" : "Confirm — sign in wallet"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <Button variant="secondary" onClick={() => setConfirming(true)}>
                    Revoke allowance
                  </Button>
                </div>
              ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
