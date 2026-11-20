import { formatUnits } from "viem";

/**
 * CoinGecko mapping for the supported networks (spec §10).
 *
 * Prices come from CoinGecko's public API via our /api/prices proxy.
 * Testnets have no market price: Sepolia maps to no native id and no
 * token platform, so its prices are always null — never invented.
 */

export const COINGECKO_PLATFORMS: Record<number, string | null> = {
  1: "ethereum",
  56: "binance-smart-chain",
  137: "polygon-pos",
  42161: "arbitrum-one",
  10: "optimistic-ethereum",
  8453: "base",
  43114: "avalanche",
  11155111: null,
};

export const NATIVE_COINGECKO_IDS: Record<number, string | null> = {
  1: "ethereum",
  56: "binancecoin",
  137: "polygon-ecosystem-token",
  42161: "ethereum",
  10: "ethereum",
  8453: "ethereum",
  43114: "avalanche-2",
  11155111: null,
};

/** Price map returned by /api/prices: "native" or a lowercase token address → USD price. */
export type PriceMap = Record<string, number | null>;

/** USD value of a balance given its unit price; null when either side is unknown. */
export function usdValue(balanceRaw: bigint, decimals: number, price: number | null | undefined): number | null {
  if (price === null || price === undefined) return null;
  const amount = Number(formatUnits(balanceRaw, decimals));
  if (!Number.isFinite(amount)) return null;
  return amount * price;
}
