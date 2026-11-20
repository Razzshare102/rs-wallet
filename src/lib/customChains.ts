import { defineChain } from "viem";
import { z } from "zod";
import { getNetwork, type ResolvedNetwork } from "./chains";

/**
 * User-defined custom EVM networks (spec §5).
 *
 * Stored in localStorage — this is public configuration data (names, RPC
 * URLs, chain IDs), never secrets. RPC URLs entered here are used only by
 * this browser to talk to that network.
 */

const STORAGE_KEY = "rs-wallet:custom-networks";

export interface CustomNetwork {
  chainId: number;
  name: string;
  rpcUrl: string;
  currencyName: string;
  currencySymbol: string;
  currencyDecimals: number;
  explorerUrl: string | null;
  testnet: boolean;
}

const customNetworkSchema = z.object({
  chainId: z.number().int().positive(),
  name: z.string().min(1).max(64),
  rpcUrl: z.string().url(),
  currencyName: z.string().min(1).max(64),
  currencySymbol: z.string().min(1).max(12),
  currencyDecimals: z.number().int().min(0).max(36),
  explorerUrl: z.string().url().nullable(),
  testnet: z.boolean(),
});

const listSchema = z.array(customNetworkSchema);

const COLOR_PALETTE = ["#2f81f7", "#16c784", "#f0b90b", "#8247e5", "#ff7a59", "#22c3aa", "#e56399"];

export function colorForChainId(chainId: number): string {
  return COLOR_PALETTE[chainId % COLOR_PALETTE.length];
}

export function loadCustomNetworks(): CustomNetwork[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = listSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function saveCustomNetworks(networks: CustomNetwork[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(networks));
  } catch {
    /* storage unavailable — custom networks simply won't persist */
  }
}

export function customToResolved(custom: CustomNetwork): ResolvedNetwork {
  const chain = defineChain({
    id: custom.chainId,
    name: custom.name,
    nativeCurrency: {
      name: custom.currencyName,
      symbol: custom.currencySymbol,
      decimals: custom.currencyDecimals,
    },
    rpcUrls: { default: { http: [custom.rpcUrl] } },
    blockExplorers: custom.explorerUrl
      ? { default: { name: "Explorer", url: custom.explorerUrl } }
      : undefined,
    testnet: custom.testnet,
  });
  return {
    chainId: custom.chainId,
    name: custom.name,
    shortName: custom.name,
    color: colorForChainId(custom.chainId),
    testnet: custom.testnet,
    custom: true,
    chain,
    rpcUrl: custom.rpcUrl,
    explorerUrl: custom.explorerUrl,
    nativeSymbol: custom.currencySymbol,
    nativeName: custom.currencyName,
    nativeDecimals: custom.currencyDecimals,
  };
}

export interface CustomNetworkForm {
  name: string;
  chainId: string;
  rpcUrl: string;
  currencyName: string;
  currencySymbol: string;
  currencyDecimals: string;
  explorerUrl: string;
  testnet: boolean;
}

/** Returns an error message, or the normalized CustomNetwork when valid. */
export function validateCustomNetwork(
  form: CustomNetworkForm,
  existing: CustomNetwork[],
): { error: string } | { network: CustomNetwork } {
  const chainId = Number(form.chainId);
  if (!Number.isInteger(chainId) || chainId <= 0) {
    return { error: "Chain ID must be a positive whole number." };
  }
  if (getNetwork(chainId)) {
    return { error: "That chain ID is already a built-in network." };
  }
  if (existing.some((n) => n.chainId === chainId)) {
    return { error: "A custom network with that chain ID already exists." };
  }
  if (!form.name.trim()) return { error: "Network name is required." };

  let rpc: URL;
  try {
    rpc = new URL(form.rpcUrl.trim());
  } catch {
    return { error: "RPC URL is not a valid URL." };
  }
  if (rpc.protocol !== "https:" && rpc.protocol !== "http:") {
    return { error: "RPC URL must start with https:// (or http:// for local nodes)." };
  }

  let explorerUrl: string | null = null;
  if (form.explorerUrl.trim()) {
    try {
      const url = new URL(form.explorerUrl.trim());
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("protocol");
      explorerUrl = url.toString().replace(/\/$/, "");
    } catch {
      return { error: "Block explorer URL is not a valid URL." };
    }
  }

  const decimals = Number(form.currencyDecimals);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    return { error: "Currency decimals must be a whole number between 0 and 36 (usually 18)." };
  }
  if (!form.currencySymbol.trim()) return { error: "Currency symbol is required (e.g. ETH)." };
  if (!form.currencyName.trim()) return { error: "Currency name is required (e.g. Ether)." };

  return {
    network: {
      chainId,
      name: form.name.trim(),
      rpcUrl: rpc.toString(),
      currencyName: form.currencyName.trim(),
      currencySymbol: form.currencySymbol.trim().toUpperCase(),
      currencyDecimals: decimals,
      explorerUrl,
      testnet: form.testnet,
    },
  };
}
