import { createPublicClient, http, type Address, type PublicClient } from "viem";
import type { ResolvedNetwork } from "./chains";

/**
 * Read-only viem public clients, one per network, cached.
 * Used for balances, metadata, gas estimation and receipt tracking for
 * BOTH wallet modes (reads never need a signer).
 */

const cache = new Map<number, PublicClient>();

export function getPublicClient(network: ResolvedNetwork): PublicClient {
  const existing = cache.get(network.chainId);
  if (existing) return existing;
  const client = createPublicClient({
    chain: network.chain,
    transport: http(network.rpcUrl),
  }) as PublicClient;
  cache.set(network.chainId, client);
  return client;
}

export const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
}

/** Reads ERC-20 metadata from the contract itself. Throws if not a contract / not ERC-20. */
export async function fetchTokenMetadata(
  network: ResolvedNetwork,
  address: Address,
): Promise<TokenMetadata> {
  const client = getPublicClient(network);
  const code = await client.getCode({ address });
  if (!code || code === "0x") {
    throw new Error("No contract found at that address on this network.");
  }
  const [name, symbol, decimals] = await Promise.all([
    client.readContract({ address, abi: ERC20_ABI, functionName: "name" }),
    client.readContract({ address, abi: ERC20_ABI, functionName: "symbol" }),
    client.readContract({ address, abi: ERC20_ABI, functionName: "decimals" }),
  ]);
  return { name, symbol, decimals };
}
