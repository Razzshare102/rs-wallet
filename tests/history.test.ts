import { describe, expect, it } from "vitest";
import {
  mergeActivity,
  normalizeNativeRow,
  normalizeTokenRow,
} from "../src/lib/history";
import type { StoredTx } from "../src/lib/activity";

const ME = "0x1111111111111111111111111111111111111111";
const OTHER = "0x2222222222222222222222222222222222222222";
const HASH = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const TOKEN = "0x55d398326f99059fF775485246999027B3197955" as const;

describe("explorer history normalization", () => {
  it("normalizes an outgoing native transfer as a confirmed send", () => {
    const tx = normalizeNativeRow(
      {
        hash: HASH,
        from: ME,
        to: OTHER,
        value: "1000000000000000000",
        timeStamp: "1700000000",
        isError: "0",
      },
      ME,
      56,
      "BNB",
      18,
    );
    expect(tx.kind).toBe("send");
    expect(tx.status).toBe("confirmed");
    expect(tx.amount).toBe("1");
    expect(tx.symbol).toBe("BNB");
    expect(tx.tokenAddress).toBeNull();
    expect(tx.timestamp).toBe(1700000000000);
  });

  it("normalizes an incoming transfer as receive and a reverted one as failed", () => {
    const incoming = normalizeNativeRow(
      { hash: HASH, from: OTHER, to: ME, value: "500000000000000000", timeStamp: "1700000000", isError: "0" },
      ME,
      1,
      "ETH",
      18,
    );
    expect(incoming.kind).toBe("receive");
    expect(incoming.amount).toBe("0.5");

    const failed = normalizeNativeRow(
      { hash: HASH, from: ME, to: OTHER, value: "0", timeStamp: "1700000000", isError: "1" },
      ME,
      1,
      "ETH",
      18,
    );
    expect(failed.status).toBe("failed");
  });

  it("detects approve() calls from the function name", () => {
    const tx = normalizeNativeRow(
      {
        hash: HASH,
        from: ME,
        to: TOKEN,
        value: "0",
        timeStamp: "1700000000",
        isError: "0",
        functionName: "approve(address spender,uint256 amount)",
      },
      ME,
      56,
      "BNB",
      18,
    );
    expect(tx.kind).toBe("approve");
  });

  it("normalizes ERC-20 rows with the token's own decimals", () => {
    const tx = normalizeTokenRow(
      {
        hash: HASH,
        from: OTHER,
        to: ME,
        value: "2500000",
        timeStamp: "1700000000",
        contractAddress: TOKEN,
        tokenSymbol: "USDT",
        tokenDecimal: "6",
      },
      ME,
      56,
    );
    expect(tx.kind).toBe("receive");
    expect(tx.amount).toBe("2.5");
    expect(tx.symbol).toBe("USDT");
    expect(tx.tokenAddress).toBe(TOKEN);
  });
});

describe("mergeActivity", () => {
  const local: StoredTx = {
    hash: HASH,
    chainId: 56,
    from: ME as StoredTx["from"],
    to: OTHER as StoredTx["to"],
    amount: "1",
    symbol: "BNB",
    tokenAddress: null,
    kind: "send",
    status: "pending",
    timestamp: 1700000000000,
  };
  const explorerSame: StoredTx = { ...local, status: "confirmed" };

  it("dedupes by hash+token and lets a final explorer status beat local pending", () => {
    const merged = mergeActivity([local], [explorerSame]);
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe("confirmed");
  });

  it("keeps native and token entries of the same hash separate", () => {
    const tokenTx: StoredTx = { ...local, tokenAddress: TOKEN, symbol: "USDT", status: "confirmed" };
    const merged = mergeActivity([local], [tokenTx]);
    expect(merged).toHaveLength(2);
  });

  it("sorts newest first", () => {
    const older: StoredTx = { ...local, hash: ("0x" + "b".repeat(64)) as StoredTx["hash"], timestamp: 1 };
    const merged = mergeActivity([older, local], []);
    expect(merged[0].timestamp).toBe(1700000000000);
  });
});
