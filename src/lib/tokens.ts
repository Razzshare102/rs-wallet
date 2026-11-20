import type { Address } from "viem";

/**
 * Curated ERC-20 registry — canonical contract addresses for well-known
 * tokens on each built-in network (spec §8). Only addresses that are
 * publicly canonical (issuer documentation / major explorers) are listed.
 * Anything a user adds themselves is treated as a custom, unverified token
 * and labelled as such in the UI.
 */
export interface TokenInfo {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  /** True for this curated registry; false for user-added custom tokens. */
  verified: boolean;
  logoURI?: string;
}

function t(
  address: Address,
  name: string,
  symbol: string,
  decimals = 18,
): TokenInfo {
  return { address, name, symbol, decimals, verified: true };
}

export const TOKEN_REGISTRY: Record<number, TokenInfo[]> = {
  // Ethereum
  1: [
    t("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "USD Coin", "USDC", 6),
    t("0xdAC17F958D2ee523a2206206994597C13D831ec7", "Tether USD", "USDT", 6),
    t("0x6B175474E89094C44Da98b954EedeAC495271d0F", "Dai Stablecoin", "DAI"),
    t("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "Wrapped Ether", "WETH"),
  ],
  // BNB Chain
  56: [
    t("0x55d398326f99059fF775485246999027B3197955", "Tether USD", "USDT"),
    t("0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", "USD Coin", "USDC"),
    t("0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", "Binance USD", "BUSD"),
    t("0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3", "Dai Stablecoin", "DAI"),
    t("0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", "Wrapped BNB", "WBNB"),
  ],
  // Polygon
  137: [
    t("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", "USD Coin", "USDC", 6),
    t("0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", "USD Coin (Bridged)", "USDC.e", 6),
    t("0xc2132D05D31c914a87C6611C10748AEb04B58e8F", "Tether USD", "USDT", 6),
    t("0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", "Dai Stablecoin", "DAI"),
    t("0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", "Wrapped Ether", "WETH"),
    t("0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", "Wrapped Matic", "WMATIC"),
  ],
  // Arbitrum One
  42161: [
    t("0xaf88d065e77c8cC2239327C5EDb3A432268e5831", "USD Coin", "USDC", 6),
    t("0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", "USD Coin (Bridged)", "USDC.e", 6),
    t("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", "Tether USD", "USDT", 6),
    t("0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", "Dai Stablecoin", "DAI"),
    t("0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", "Wrapped Ether", "WETH"),
  ],
  // Optimism
  10: [
    t("0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", "USD Coin", "USDC", 6),
    t("0x7F5c764cBc14f9669B88837ca1490cCa17c31607", "USD Coin (Bridged)", "USDC.e", 6),
    t("0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", "Tether USD", "USDT", 6),
    t("0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", "Dai Stablecoin", "DAI"),
    t("0x4200000000000000000000000000000000000006", "Wrapped Ether", "WETH"),
  ],
  // Base
  8453: [
    t("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "USD Coin", "USDC", 6),
    t("0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", "Dai Stablecoin", "DAI"),
    t("0x4200000000000000000000000000000000000006", "Wrapped Ether", "WETH"),
  ],
  // Avalanche C-Chain
  43114: [
    t("0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", "USD Coin", "USDC", 6),
    t("0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", "Tether USD", "USDT", 6),
    t("0xd586E7F844cEa2F87f50152665BCbc2C279D8d70", "Dai Stablecoin", "DAI.e"),
    t("0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", "Wrapped AVAX", "WAVAX"),
  ],
  // Sepolia (testnet)
  11155111: [t("0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9", "Wrapped Ether", "WETH")],
};

export function registryTokens(chainId: number): TokenInfo[] {
  return TOKEN_REGISTRY[chainId] ?? [];
}

export function findRegistryToken(chainId: number, address: string): TokenInfo | undefined {
  return registryTokens(chainId).find(
    (token) => token.address.toLowerCase() === address.toLowerCase(),
  );
}
