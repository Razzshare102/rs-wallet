"use client";

import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { appKitNetworks, appMetadata, projectId, wagmiAdapter } from "@/config/wagmi";
import { wagmiConfig } from "@/config/wagmi";
import { hasReownProjectId } from "@/lib/env";

// Initialize AppKit exactly once at module scope, and only when a Project
// ID exists. This must also run during SSR/prerender: pages render the
// AppKit connect button on the server, and its `useAppKit` hook throws if
// no AppKit instance exists yet. `createAppKit` itself is SSR-safe (it is
// how Reown's own Next.js integration initializes), so there is no window
// gate here. Injected wallets (MetaMask, Rabby, Coinbase) work through
// wagmi either way.
let appKitInitialized = false;
function initAppKit() {
  if (appKitInitialized) return;
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
