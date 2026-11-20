import type { Address, Hash } from "viem";

/**
 * Local transaction history (spec §11).
 *
 * RS WALLET has no backend, so activity is assembled from two sources:
 *  1. Transactions this app broadcast — recorded here at send time and
 *     tracked to confirmation (this module).
 *  2. On-chain history fetched from the block explorer API for the active
 *     network (see the Activity page; merged + deduplicated by hash).
 *
 * Stored per address in localStorage. Transaction metadata is public
 * on-chain data — never secrets.
 */

export type TxKind = "send" | "receive" | "swap" | "approve" | "contract";
export type TxStatus = "pending" | "confirmed" | "failed";

export interface StoredTx {
  hash: Hash;
  chainId: number;
  from: Address;
  to: Address | null;
  /** Human amount in token units, as a decimal string (display only). */
  amount: string;
  symbol: string;
  /** ERC-20 contract, or null for the native token. */
  tokenAddress: Address | null;
  kind: TxKind;
  status: TxStatus;
  timestamp: number; // ms
  nonce?: number;
}

const PREFIX = "rs-wallet:txs:";

function storageKey(address: string): string {
  return `${PREFIX}${address.toLowerCase()}`;
}

export function loadTxs(address: string): StoredTx[] {
  try {
    const raw = window.localStorage.getItem(storageKey(address));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredTx[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTxs(address: string, txs: StoredTx[]): void {
  try {
    window.localStorage.setItem(storageKey(address), JSON.stringify(txs.slice(0, 200)));
  } catch {
    /* ignore */
  }
}

export function addTx(address: string, tx: StoredTx): void {
  const existing = loadTxs(address);
  if (existing.some((t) => t.hash.toLowerCase() === tx.hash.toLowerCase())) return;
  saveTxs(address, [tx, ...existing]);
}

export function updateTxStatus(address: string, hash: string, status: TxStatus): void {
  const txs = loadTxs(address);
  const next = txs.map((t) =>
    t.hash.toLowerCase() === hash.toLowerCase() ? { ...t, status } : t,
  );
  saveTxs(address, next);
}
