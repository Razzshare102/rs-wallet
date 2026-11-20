// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { addTx, loadTxs, updateTxStatus, type StoredTx } from "@/lib/activity";

const ADDRESS = "0x9858EfFD232B4033E47d90003D41EC34EcaEda94";

function makeTx(hash: string): StoredTx {
  return {
    hash: hash as StoredTx["hash"],
    chainId: 56,
    from: ADDRESS as StoredTx["from"],
    to: "0x000000000000000000000000000000000000dEaD",
    amount: "1.5",
    symbol: "BNB",
    tokenAddress: null,
    kind: "send",
    status: "pending",
    timestamp: 1_700_000_000_000,
  };
}

describe("local activity store", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("records, deduplicates and updates transactions", () => {
    const tx = makeTx(`0x${"a".repeat(64)}`);
    addTx(ADDRESS, tx);
    addTx(ADDRESS, tx); // duplicate broadcast must not double-record
    expect(loadTxs(ADDRESS)).toHaveLength(1);

    updateTxStatus(ADDRESS, tx.hash, "confirmed");
    const loaded = loadTxs(ADDRESS);
    expect(loaded[0].status).toBe("confirmed");
    expect(loaded[0].symbol).toBe("BNB");
  });

  it("keeps histories separate per address", () => {
    addTx(ADDRESS, makeTx(`0x${"b".repeat(64)}`));
    expect(loadTxs("0x0000000000000000000000000000000000000001")).toHaveLength(0);
    expect(loadTxs(ADDRESS.toLowerCase())).toHaveLength(1);
  });
});
