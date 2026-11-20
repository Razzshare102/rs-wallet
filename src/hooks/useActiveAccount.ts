"use client";

import { useAccount } from "wagmi";
import { useVault } from "@/components/wallet/VaultProvider";

export type AccountSource = "external" | "builtin";

export interface ActiveAccount {
  address: `0x${string}` | undefined;
  source: AccountSource | null;
  isConnected: boolean;
}

/**
 * The account the whole app acts on.
 *
 * Precedence: an unlocked built-in wallet is the active account (it can
 * sign in-app); otherwise the connected external wallet. The Dashboard and
 * Accounts pages always label which source is active, and the header shows
 * both when both exist.
 */
export function useActiveAccount(): ActiveAccount {
  const { address, isConnected } = useAccount();
  const { status, activeAccount } = useVault();

  if (status === "unlocked" && activeAccount) {
    return { address: activeAccount.address, source: "builtin", isConnected: true };
  }
  if (isConnected && address) {
    return { address, source: "external", isConnected: true };
  }
  return { address: undefined, source: null, isConnected: false };
}
