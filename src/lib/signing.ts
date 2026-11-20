import { createWalletClient, http, type LocalAccount, type WalletClient } from "viem";
import type { ResolvedNetwork } from "./chains";

/** Wallet client that signs with a built-in (vault) account. */
export function builtinWalletClient(account: LocalAccount, network: ResolvedNetwork): WalletClient {
  return createWalletClient({
    account,
    chain: network.chain,
    transport: http(network.rpcUrl),
  });
}

/** Maps wallet/RPC errors to messages a person can act on. Never leaks internals. */
export function humanizeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  if (lower.includes("user rejected") || lower.includes("user denied") || lower.includes("rejected the request")) {
    return "You rejected the request in your wallet. Nothing was sent.";
  }
  if (lower.includes("insufficient funds")) {
    return "Insufficient funds to cover the amount plus network fees.";
  }
  if (lower.includes("nonce")) {
    return "Transaction nonce conflict. Wait for pending transactions to settle, then try again.";
  }
  if (lower.includes("gas") && (lower.includes("exceed") || lower.includes("limit"))) {
    return "The transaction would exceed the gas limit and likely fail.";
  }
  if (lower.includes("failed to fetch") || lower.includes("network") || lower.includes("timeout") || lower.includes("http request")) {
    return "Network/RPC problem. Check your connection or try a different RPC endpoint in Networks.";
  }
  // Keep the first line of the original message for anything else — it is
  // usually the meaningful part (e.g. a contract revert reason).
  const firstLine = message.split("\n")[0];
  return firstLine.length > 220 ? `${firstLine.slice(0, 220)}…` : firstLine;
}
