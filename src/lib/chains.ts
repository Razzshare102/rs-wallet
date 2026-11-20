import {
  mainnet,
  bsc,
  polygon,
  arbitrum,
  optimism,
  base,
  avalanche,
  sepolia,
  type Chain,
} from "viem/chains";

/**
 * Supported EVM networks (spec §5). RPC endpoints can be overridden with
 * NEXT_PUBLIC_RPC_<chainId> environment variables; otherwise the public
 * defaults shipped with viem's chain definitions are used.
 * No private API keys are hardcoded anywhere.
 */
export interface RsNetwork {
  chain: Chain;
  /** Short ticker used in compact UI */
  shortName: string;
  /** Brand-ish accent for the network dot/logo fallback */
  color: string;
  testnet?: boolean;
}

/** A network fully resolved for UI + viem client construction. */
export interface ResolvedNetwork {
  chainId: number;
  name: string;
  shortName: string;
  color: string;
  testnet: boolean;
  custom: boolean;
  chain: Chain;
  rpcUrl: string;
  explorerUrl: string | null;
  nativeSymbol: string;
  nativeName: string;
  nativeDecimals: number;
}

const RPC_OVERRIDES: Record<number, string | undefined> = {
  1: process.env.NEXT_PUBLIC_RPC_1,
  56: process.env.NEXT_PUBLIC_RPC_56,
  137: process.env.NEXT_PUBLIC_RPC_137,
  42161: process.env.NEXT_PUBLIC_RPC_42161,
  10: process.env.NEXT_PUBLIC_RPC_10,
  8453: process.env.NEXT_PUBLIC_RPC_8453,
  43114: process.env.NEXT_PUBLIC_RPC_43114,
  11155111: process.env.NEXT_PUBLIC_RPC_11155111,
};

function withRpc(chain: Chain): Chain {
  const override = RPC_OVERRIDES[chain.id];
  if (!override) return chain;
  return {
    ...chain,
    rpcUrls: {
      ...chain.rpcUrls,
      default: { http: [override] },
    },
  };
}

export const SUPPORTED_NETWORKS: RsNetwork[] = [
  { chain: withRpc(mainnet), shortName: "Ethereum", color: "#627eea" },
  { chain: withRpc(bsc), shortName: "BNB Chain", color: "#f0b90b" },
  { chain: withRpc(polygon), shortName: "Polygon", color: "#8247e5" },
  { chain: withRpc(arbitrum), shortName: "Arbitrum", color: "#28a0f0" },
  { chain: withRpc(optimism), shortName: "Optimism", color: "#ff0420" },
  { chain: withRpc(base), shortName: "Base", color: "#0052ff" },
  { chain: withRpc(avalanche), shortName: "Avalanche", color: "#e84142" },
  { chain: withRpc(sepolia), shortName: "Sepolia", color: "#8b96b0", testnet: true },
];

export const SUPPORTED_CHAINS: Chain[] = SUPPORTED_NETWORKS.map((n) => n.chain);

export const DEFAULT_CHAIN = mainnet;

export function getNetwork(chainId: number): RsNetwork | undefined {
  return SUPPORTED_NETWORKS.find((n) => n.chain.id === chainId);
}

export function resolveBuiltin(chainId: number): ResolvedNetwork | undefined {
  const net = getNetwork(chainId);
  if (!net) return undefined;
  return {
    chainId: net.chain.id,
    name: net.chain.name,
    shortName: net.shortName,
    color: net.color,
    testnet: Boolean(net.testnet),
    custom: false,
    chain: net.chain,
    rpcUrl: net.chain.rpcUrls.default.http[0],
    explorerUrl: net.chain.blockExplorers?.default.url ?? null,
    nativeSymbol: net.chain.nativeCurrency.symbol,
    nativeName: net.chain.nativeCurrency.name,
    nativeDecimals: net.chain.nativeCurrency.decimals,
  };
}

export const BUILTIN_RESOLVED: ResolvedNetwork[] = SUPPORTED_NETWORKS.map((n) =>
  resolveBuiltin(n.chain.id),
).filter((n): n is ResolvedNetwork => Boolean(n));

export function explorerTxUrlFor(network: ResolvedNetwork, hash: string): string | null {
  return network.explorerUrl ? `${network.explorerUrl}/tx/${hash}` : null;
}

export function explorerAddressUrlFor(network: ResolvedNetwork, address: string): string | null {
  return network.explorerUrl ? `${network.explorerUrl}/address/${address}` : null;
}

export function explorerTxUrl(chainId: number, hash: string): string | null {
  const net = getNetwork(chainId);
  const base = net?.chain.blockExplorers?.default.url;
  return base ? `${base}/tx/${hash}` : null;
}

export function explorerAddressUrl(chainId: number, address: string): string | null {
  const net = getNetwork(chainId);
  const base = net?.chain.blockExplorers?.default.url;
  return base ? `${base}/address/${address}` : null;
}
