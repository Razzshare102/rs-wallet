import { formatUnits, getAddress, type Address, type Hash } from "viem";
import type { StoredTx } from "./activity";

/**
 * Block-explorer history normalization + merging (spec §11).
 *
 * Explorer rows (Etherscan-family API) arrive as all-string records.
 * These pure functions turn them into the same StoredTx shape the app
 * records locally at send time, then merge both sources deduplicated
 * by (hash, token). Local entries win on metadata; a confirmed/failed
 * explorer status wins over a local "pending".
 */

export interface ExplorerNativeRow {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  isError?: string;
  functionName?: string;
  contractAddress?: string;
}

export interface ExplorerTokenRow {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  contractAddress: string;
  tokenSymbol: string;
  tokenDecimal: string;
}

function formatAmount(rawValue: string, decimals: number): string {
  let value: bigint;
  try {
    value = BigInt(rawValue || "0");
  } catch {
    return "0";
  }
  const formatted = formatUnits(value, decimals);
  const num = Number(formatted);
  if (num === 0) return "0";
  if (num < 0.000001) return "<0.000001";
  return num.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function checksum(address: string): Address {
  try {
    return getAddress(address);
  } catch {
    return address as Address;
  }
}

function direction(from: string, address: string): "send" | "receive" {
  return from.toLowerCase() === address.toLowerCase() ? "send" : "receive";
}

export function normalizeNativeRow(
  row: ExplorerNativeRow,
  address: string,
  chainId: number,
  nativeSymbol: string,
  nativeDecimals: number,
): StoredTx {
  const kind = row.functionName?.startsWith("approve")
    ? "approve"
    : !row.to
      ? "contract"
      : direction(row.from, address);
  return {
    hash: row.hash as Hash,
    chainId,
    from: checksum(row.from),
    to: row.to ? checksum(row.to) : null,
    amount: formatAmount(row.value, nativeDecimals),
    symbol: nativeSymbol,
    tokenAddress: null,
    kind,
    status: row.isError === "1" ? "failed" : "confirmed",
    timestamp: Number(row.timeStamp) * 1000,
  };
}

export function normalizeTokenRow(
  row: ExplorerTokenRow,
  address: string,
  chainId: number,
): StoredTx {
  const decimals = Number(row.tokenDecimal) || 18;
  return {
    hash: row.hash as Hash,
    chainId,
    from: checksum(row.from),
    to: row.to ? checksum(row.to) : null,
    amount: formatAmount(row.value, decimals),
    symbol: row.tokenSymbol || "TOKEN",
    tokenAddress: checksum(row.contractAddress),
    kind: direction(row.from, address),
    status: "confirmed",
    timestamp: Number(row.timeStamp) * 1000,
  };
}

function mergeKey(tx: StoredTx): string {
  return `${tx.hash.toLowerCase()}:${tx.tokenAddress?.toLowerCase() ?? "native"}`;
}

/** Merge local + explorer transactions: dedupe, newest first, capped. */
export function mergeActivity(local: StoredTx[], explorer: StoredTx[]): StoredTx[] {
  const byKey = new Map<string, StoredTx>();
  for (const tx of explorer) byKey.set(mergeKey(tx), tx);
  for (const tx of local) {
    const key = mergeKey(tx);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, tx);
    } else {
      // Local metadata wins; a final explorer status beats local pending.
      byKey.set(key, {
        ...tx,
        status:
          tx.status === "pending" && existing.status !== "pending"
            ? existing.status
            : tx.status,
      });
    }
  }
  return [...byKey.values()]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 100);
}
