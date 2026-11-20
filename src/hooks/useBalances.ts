"use client";

import { useQuery } from "@tanstack/react-query";
import { formatUnits, type Address } from "viem";
import type { ResolvedNetwork } from "@/lib/chains";
import { ERC20_ABI, getPublicClient } from "@/lib/publicClient";
import { useTokenList } from "./useTokenList";
import type { TokenInfo } from "@/lib/tokens";

export interface BalanceEntry {
  kind: "native" | "erc20";
  /** Null for the native token. */
  token: TokenInfo | null;
  symbol: string;
  name: string;
  decimals: number;
  balance: bigint;
  formatted: string;
}

export function trimNumber(formatted: string, maxDecimals = 6): string {
  const num = Number(formatted);
  if (num === 0) return "0";
  if (num < 0.000001) return "<0.000001";
  return num.toLocaleString("en-US", { maximumFractionDigits: maxDecimals });
}

/**
 * Real balances for an address on a network: native + every token in the
 * token list, read directly from the chain via the network's RPC.
 * Polls every 30s; the UI also offers manual refresh.
 */
export function useBalances(address: Address | undefined, network: ResolvedNetwork | null) {
  const { tokens } = useTokenList(network?.chainId ?? 0);

  const query = useQuery({
    queryKey: ["balances", network?.chainId, address, tokens.map((t) => t.address).join(",")],
    enabled: Boolean(address && network),
    refetchInterval: 30_000,
    queryFn: async (): Promise<BalanceEntry[]> => {
      if (!address || !network) return [];
      const client = getPublicClient(network);

      const nativeBalance = await client.getBalance({ address });
      const entries: BalanceEntry[] = [
        {
          kind: "native",
          token: null,
          symbol: network.nativeSymbol,
          name: network.nativeName,
          decimals: network.nativeDecimals,
          balance: nativeBalance,
          formatted: trimNumber(formatUnits(nativeBalance, network.nativeDecimals)),
        },
      ];

      if (tokens.length > 0) {
        const results = await client.multicall({
          contracts: tokens.map((token) => ({
            address: token.address,
            abi: ERC20_ABI,
            functionName: "balanceOf" as const,
            args: [address] as const,
          })),
          allowFailure: true,
        });
        results.forEach((result, i) => {
          const token = tokens[i];
          if (result.status !== "success") return; // skip unreadable tokens, keep the rest
          const balance = result.result as bigint;
          entries.push({
            kind: "erc20",
            token,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            balance,
            formatted: trimNumber(formatUnits(balance, token.decimals)),
          });
        });
      }
      return entries;
    },
  });

  return {
    entries: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
