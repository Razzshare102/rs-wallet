"use client";

import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { appKitNetworks, appMetadata, projectId, wagmiAdapter } from "@/config/wagmi";
import { wagmiConfig } from "@/config/wagmi";
import { hasReownProjectId } from "@/lib/env";

// Initialize AppKit exactly once, and only when a Project ID exists.
// Injected wallets (MetaMask, Rabby, Coinbase) work through wagmi either way.
let appKitInitialized = false;
function initAppKit() {
  if (appKitInitialized || typeof window === "undefined") return;
  appKitInitialized = true;
  if (!hasReownProjectId) return;
  createAppKit({
    adapters: [wagmiAdapter],
    projectId,
    networks: appKitNetworks,
    metadata: appMetadata,
    themeMode: "dark",
    themeVariables: {
      "--w3m-accent": "#7c5cff",
      "--w3m-border-radius-master": "4px",
    },
    features: { analytics: false },
  });
}

initAppKit();

export function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
