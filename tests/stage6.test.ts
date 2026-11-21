import { describe, expect, it } from "vitest";
import { minReceived, normalizeZeroExQuote, SWAP_FEE_BPS, SWAP_FEE_RECIPIENT } from "../src/lib/swap";
import { COINGECKO_PLATFORMS, NATIVE_COINGECKO_IDS, usdValue } from "../src/lib/prices";

const SPENDER = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const ROUTER = "0xDef1C0ded9bec7F1a1670819833240f027b25EfF";

function rawQuote(overrides: Record<string, unknown> = {}) {
  return {
    buyAmount: "2500000",
    sellAmount: "1000000000000000000",
    liquidityAvailable: true,
    totalNetworkFee: { amountUsd: "0.42" },
    issues: { allowance: { actual: "0", spender: SPENDER } },
    transaction: { to: ROUTER, data: "0xabcdef", value: "1000000000000000000", gas: "150000" },
    ...overrides,
  };
}

describe("normalizeZeroExQuote", () => {
  it("keeps the fields the signing flow needs", () => {
    const q = normalizeZeroExQuote(rawQuote());
    expect(q.buyAmount).toBe("2500000");
    expect(q.allowanceSpender).toBe(SPENDER);
    expect(q.allowanceActual).toBe("0");
    expect(q.transaction.to).toBe(ROUTER);
    expect(q.transaction.value).toBe("1000000000000000000");
    expect(q.estimatedGasUsd).toBe("0.42");
  });

  it("throws on missing transaction data instead of offering a bad tx", () => {
    expect(() => normalizeZeroExQuote(rawQuote({ transaction: null }))).toThrow();
    expect(() => normalizeZeroExQuote(rawQuote({ buyAmount: undefined }))).toThrow();
    expect(() => normalizeZeroExQuote(null)).toThrow();
  });

  it("throws a clear error when there is no liquidity", () => {
    expect(() => normalizeZeroExQuote(rawQuote({ liquidityAvailable: false }))).toThrow(
      /No liquidity/,
    );
  });

  it("parses the 1% integrator fee and defaults to null without one", () => {
    expect(normalizeZeroExQuote(rawQuote()).integratorFee).toBeNull();
    const q = normalizeZeroExQuote(
      rawQuote({ fees: { integratorFee: { amount: "10000000000000000", token: ROUTER, type: "integrator" } } }),
    );
    expect(q.integratorFee).toEqual({ amount: "10000000000000000", token: ROUTER });
    expect(SWAP_FEE_BPS).toBe(100);
    expect(SWAP_FEE_RECIPIENT).toBe("0x0138Fd2dF24f241A8dFF555B802EA595ed8bE1A2");
  });

  it("allows a null allowance (native sell needs none)", () => {
    const q = normalizeZeroExQuote(rawQuote({ issues: { allowance: null } }));
    expect(q.allowanceSpender).toBeNull();
    expect(q.allowanceActual).toBeNull();
  });
});

describe("minReceived", () => {
  it("applies slippage in basis points with integer floor", () => {
    expect(minReceived("1000000", 50)).toBe(995000n); // 0.5%
    expect(minReceived("1000000", 0)).toBe(1000000n);
    expect(minReceived("999", 100)).toBe(989n); // floor of 989.01
  });
});

describe("price mappings", () => {
  it("maps every built-in chain, with testnet prices explicitly null", () => {
    for (const chainId of [1, 56, 137, 42161, 10, 8453, 43114]) {
      expect(NATIVE_COINGECKO_IDS[chainId]).toBeTruthy();
      expect(COINGECKO_PLATFORMS[chainId]).toBeTruthy();
    }
    expect(NATIVE_COINGECKO_IDS[11155111]).toBeNull();
    expect(COINGECKO_PLATFORMS[11155111]).toBeNull();
  });

  it("computes USD values and returns null for unknown prices", () => {
    expect(usdValue(2_000_000n, 6, 1.0)).toBe(2);
    expect(usdValue(1_500_000_000_000_000_000n, 18, 3000)).toBe(4500);
    expect(usdValue(1_000_000n, 6, null)).toBeNull();
    expect(usdValue(1_000_000n, 6, undefined)).toBeNull();
  });
});
