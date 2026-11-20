"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import type { PriceMap } from "@/lib/prices";

/**
 * USD prices for the native token + a set of ERC-20s on one network,
 * via the /api/prices CoinGecko proxy. Prices are display-only market
 * data; unknown tokens and testnets return null.
 */
export function usePrices(chainId: number, tokenAddresses: Address[]) {
  const key = tokenAddresses.map((a) => a.toLowerCase()).sort().join(",");
  const query = useQuery({
    queryKey: ["prices", chainId, key],
    enabled: chainId > 0,
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: async (): Promise<PriceMap> => {
      const params = new URLSearchParams({ chainId: String(chainId) });
      if (key) params.set("tokens", key);
      const res = await fetch(`/api/prices?${params}`);
      if (!res.ok) return { native: null };
      const data = (await res.json()) as { prices?: PriceMap };
      return data.prices ?? { native: null };
    },
  });

  const prices = query.data ?? { native: null };
  return {
    prices,
    priceFor: (tokenAddress: Address | null): number | null =>
      tokenAddress ? (prices[tokenAddress.toLowerCase()] ?? null) : (prices.native ?? null),
    isLoading: query.isLoading,
  };
}
