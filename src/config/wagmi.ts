import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import type { AppKitNetwork } from "@reown/appkit/networks";
import { SUPPORTED_CHAINS } from "@/lib/chains";
import { appUrl, reownProjectId } from "@/lib/env";

/**
 * Wagmi + Reown AppKit configuration (spec §3B).
 * The WagmiAdapter always provides injected + Coinbase Wallet connectors.
 * WalletConnect (QR / mobile wallets) activates once a real Reown Project
 * ID is configured; without one the UI surfaces a configuration notice
 * instead of failing silently.
 */
export const projectId = reownProjectId;

export const appKitNetworks = SUPPORTED_CHAINS as unknown as [
  AppKitNetwork,
  ...AppKitNetwork[],
];

export const wagmiAdapter = new WagmiAdapter({
  ssr: true,
  projectId: projectId || "rs-wallet-unconfigured",
  networks: appKitNetworks,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

export const appMetadata = {
  name: "RS WALLET",
  description: "RS WALLET — non-custodial EVM wallet",
  url: appUrl,
  icons: [`${appUrl}/icon.svg`],
};
