import { parseUnits, type Address } from "viem";

/**
 * EIP-681 payment URIs: ethereum:<address>@<chainId>[/transfer?address=..&uint256=..]
 * https://eips.ethereum.org/EIPS/eip-681
 */
export function eip681Uri(address: Address, chainId: number): string {
  return `ethereum:${address}@${chainId}`;
}

export function eip681TokenUri(
  tokenAddress: Address,
  chainId: number,
  recipient: Address,
  amount: string,
  decimals: number,
): string {
  const value = parseUnits(amount, decimals).toString();
  return `ethereum:${tokenAddress}@${chainId}/transfer?address=${recipient}&uint256=${value}`;
}
