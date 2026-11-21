import type { Address, Hash } from "viem";

/**
 * 0x Swap (allowance-holder) quote normalization (spec §9).
 *
 * The /api/swap/quote route proxies the 0x API with the server-side
 * key and passes the raw v2 response through `normalizeZeroExQuote`,
 * which keeps only the fields the UI needs and validates the shapes
 * the signing flow depends on (transaction target/data/value and the
 * allowance spender). Anything unexpected throws — the UI then shows
 * an error instead of offering a signable transaction.
 */

/**
 * RS WALLET swap fee: 1% of the sell amount, collected by 0x on every
 * swap and paid to the owner's wallet (set by Razz, 2026-11-21). The
 * fee is part of the quote the user reviews before signing — never
 * hidden, never added after the fact. The recipient can be overridden
 * with the server env var SWAP_FEE_RECIPIENT.
 */
export const SWAP_FEE_BPS = 100; // 1%
export const SWAP_FEE_RECIPIENT: Address = "0x0138Fd2dF24f241A8dFF555B802EA595ed8bE1A2";

export interface SwapQuote {
  sellAmount: string; // base units
  buyAmount: string; // base units
  /** Integrator (RS WALLET) fee taken from the sell token, base units. */
  integratorFee: { amount: string; token: Address } | null;
  allowanceSpender: Address | null;
  allowanceActual: string | null; // base units currently approved
  transaction: {
    to: Address;
    data: Hash;
    value: string; // wei, decimal string
    gas: string | null;
  };
  estimatedGasUsd: string | null;
}

interface RawQuote {
  buyAmount?: unknown;
  sellAmount?: unknown;
  fees?: { integratorFee?: { amount?: unknown; token?: unknown } | null } | null;
  totalNetworkFee?: { amountUsd?: unknown } | null;
  issues?: { allowance?: { actual?: unknown; spender?: unknown } | null } | null;
  transaction?: { to?: unknown; data?: unknown; value?: unknown; gas?: unknown } | null;
  liquidityAvailable?: unknown;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asAddress(value: unknown): Address | null {
  const s = asString(value);
  return s && /^0x[0-9a-fA-F]{40}$/.test(s) ? (s as Address) : null;
}

export function normalizeZeroExQuote(raw: unknown): SwapQuote {
  const quote = (raw ?? {}) as RawQuote;
  if (quote.liquidityAvailable === false) {
    throw new Error("No liquidity available for this pair on this network.");
  }
  const buyAmount = asString(quote.buyAmount);
  const sellAmount = asString(quote.sellAmount);
  const tx = quote.transaction ?? null;
  const to = asAddress(tx?.to);
  const data = asString(tx?.data);
  const value = asString(tx?.value) ?? "0";
  if (!buyAmount || !sellAmount || !to || !data) {
    throw new Error("The aggregator returned an incomplete quote. Please try again.");
  }
  const allowance = quote.issues?.allowance ?? null;
  const rawFee = quote.fees?.integratorFee ?? null;
  const feeAmount = rawFee ? asString(rawFee.amount) : null;
  const feeToken = rawFee ? asAddress(rawFee.token) : null;
  return {
    sellAmount,
    buyAmount,
    integratorFee: feeAmount && feeToken ? { amount: feeAmount, token: feeToken } : null,
    allowanceSpender: allowance ? asAddress(allowance.spender) : null,
    allowanceActual: allowance ? asString(allowance.actual) : null,
    transaction: {
      to,
      data: data as Hash,
      value,
      gas: asString(tx?.gas),
    },
    estimatedGasUsd: asString(quote.totalNetworkFee?.amountUsd),
  };
}

/** Minimum received after slippage, in base units (integer floor). */
export function minReceived(buyAmount: string, slippageBps: number): bigint {
  const amount = BigInt(buyAmount);
  return (amount * BigInt(10_000 - slippageBps)) / 10_000n;
}

export const SLIPPAGE_OPTIONS: { label: string; bps: number }[] = [
  { label: "0.1%", bps: 10 },
  { label: "0.5%", bps: 50 },
  { label: "1.0%", bps: 100 },
];
