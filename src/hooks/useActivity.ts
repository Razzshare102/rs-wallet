"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import type { ResolvedNetwork } from "@/lib/chains";
import { loadTxs, updateTxStatus, type StoredTx } from "@/lib/activity";
import { mergeActivity } from "@/lib/history";
import { getPublicClient } from "@/lib/publicClient";

interface HistoryResponse {
  txs: StoredTx[];
  error?: string;
}

/**
 * Activity for the active account on the active network:
 *  - transactions this app broadcast (localStorage), tracked to
 *    confirmation by polling receipts every 12s while any are pending;
 *  - on-chain history from the block explorer (via /api/history),
 *    merged + deduplicated by hash.
 */
export function useActivity(address: Address | undefined, network: ResolvedNetwork | null) {
  const queryClient = useQueryClient();
  const chainId = network?.chainId ?? 0;
  const [localTxs, setLocalTxs] = useState<StoredTx[]>([]);

  const reloadLocal = useCallback(() => {
    if (!address) {
      setLocalTxs([]);
      return;
    }
    setLocalTxs(loadTxs(address).filter((t) => t.chainId === chainId));
  }, [address, chainId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is an external store; loading it after mount is the SSR-safe hydration pattern
    reloadLocal();
  }, [reloadLocal]);

  const explorer = useQuery({
    queryKey: ["explorer-history", chainId, address],
    enabled: Boolean(address && network && !network.custom),
    staleTime: 30_000,
    queryFn: async (): Promise<HistoryResponse> => {
      const res = await fetch(
        `/api/history?address=${address}&chainId=${chainId}`,
      );
      if (!res.ok) return { txs: [], error: "Explorer history request failed." };
      return (await res.json()) as HistoryResponse;
    },
  });

  const pending = useMemo(
    () => localTxs.filter((t) => t.status === "pending"),
    [localTxs],
  );

  // Receipt tracking for pending transactions this app broadcast.
  useEffect(() => {
    if (!address || !network || pending.length === 0) return;
    let cancelled = false;
    const check = async () => {
      const client = getPublicClient(network);
      let changed = false;
      for (const tx of pending) {
        try {
          const receipt = await client.getTransactionReceipt({ hash: tx.hash });
          if (receipt) {
            updateTxStatus(
              address,
              tx.hash,
              receipt.status === "success" ? "confirmed" : "failed",
            );
            changed = true;
          }
        } catch {
          /* not mined yet (or RPC hiccup) — try again next cycle */
        }
      }
      if (changed && !cancelled) {
        reloadLocal();
        void queryClient.invalidateQueries({ queryKey: ["balances"] });
        void queryClient.invalidateQueries({
          queryKey: ["explorer-history", chainId, address],
        });
      }
    };
    void check();
    const id = setInterval(check, 12_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [address, network, pending, reloadLocal, queryClient, chainId]);

  const txs = useMemo(
    () => mergeActivity(localTxs, explorer.data?.txs ?? []),
    [localTxs, explorer.data],
  );

  return {
    txs,
    pendingCount: pending.length,
    explorerError: network?.custom
      ? "Explorer history is not available for custom networks. Showing transactions recorded by this app only."
      : (explorer.data?.error ?? null),
    isLoading: explorer.isLoading,
    refresh: () => {
      reloadLocal();
      void explorer.refetch();
    },
  };
}
