import SignClient from "@walletconnect/sign-client";
import type { SessionTypes, SignClientTypes } from "@walletconnect/types";
import { SUPPORTED_NETWORKS } from "./chains";
import { appUrl, reownProjectId } from "./env";

/**
 * WalletConnect (SignClient) wallet-side service.
 *
 * RS WALLET acts as the *wallet*: dApps such as Uniswap or PancakeSwap show
 * a WalletConnect URI, the user pastes it on the dApps page, and every
 * session proposal and signature request is approved explicitly here
 * before the built-in vault signs anything.
 */

export const WC_CHAIN_IDS: number[] = SUPPORTED_NETWORKS.map((n) => n.chain.id);

export const WC_METHODS = [
  "eth_sendTransaction",
  "eth_signTransaction",
  "personal_sign",
  "eth_sign",
  "eth_signTypedData",
  "eth_signTypedData_v4",
  "wallet_switchEthereumChain",
] as const;

export const WC_EVENTS = ["accountsChanged", "chainChanged"] as const;

/** JSON-RPC error used when the user declines a proposal or request. */
export const WC_USER_REJECTED = { code: 5000, message: "User rejected the request." };

export type WcSession = SessionTypes.Struct;
export type WcProposal = SignClientTypes.EventArguments["session_proposal"];
export type WcRequest = SignClientTypes.EventArguments["session_request"];
export type WcClient = InstanceType<typeof SignClient>;

let clientPromise: Promise<WcClient> | null = null;

export function getSignClient(): Promise<WcClient> {
  if (!clientPromise) {
    clientPromise = SignClient.init({
      projectId: reownProjectId,
      metadata: {
        name: "RS WALLET",
        description: "RS WALLET — non-custodial EVM wallet. Your keys never leave your device.",
        url: appUrl,
        icons: [`${appUrl}/icon.svg`],
      },
    });
  }
  return clientPromise;
}

/** Namespaces offered to a dApp: every supported chain × every vault account. */
export function buildApprovedNamespaces(addresses: string[]): SessionTypes.Namespaces {
  const accounts: string[] = [];
  for (const chainId of WC_CHAIN_IDS) {
    for (const address of addresses) accounts.push(`eip155:${chainId}:${address}`);
  }
  return {
    eip155: {
      accounts,
      methods: [...WC_METHODS],
      events: [...WC_EVENTS],
    },
  };
}

/** "eip155:56" → 56 */
export function parseWcChainId(chainId: string | undefined): number | null {
  if (!chainId) return null;
  const part = chainId.split(":")[1];
  const n = Number(part);
  return Number.isFinite(n) ? n : null;
}
