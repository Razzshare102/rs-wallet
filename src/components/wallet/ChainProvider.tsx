"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAccount, useConfig, useSwitchChain } from "wagmi";
import { getConnectorClient } from "wagmi/actions";
import { toHex } from "viem";
import {
  BUILTIN_RESOLVED,
  DEFAULT_CHAIN,
  resolveBuiltin,
  type ResolvedNetwork,
} from "@/lib/chains";
import {
  customToResolved,
  loadCustomNetworks,
  saveCustomNetworks,
  validateCustomNetwork,
  type CustomNetwork,
  type CustomNetworkForm,
} from "@/lib/customChains";

const STORAGE_KEY = "rs-wallet:selected-chain";

interface ChainContextValue {
  /** The app's active chain: the external wallet's chain when connected, otherwise the user's selection. */
  chainId: number;
  /** Resolved active network (built-in or custom), or null when unsupported. */
  network: ResolvedNetwork | null;
  /** All selectable networks: built-ins first, then customs. */
  networks: ResolvedNetwork[];
  customNetworks: CustomNetwork[];
  /** True when an external wallet is connected and dictates the chain. */
  external: boolean;
  setChainId: (chainId: number) => void;
  isSwitching: boolean;
  switchError: string | null;
  addCustomNetwork: (form: CustomNetworkForm) => string | null; // error message or null
  removeCustomNetwork: (chainId: number) => void;
}

const ChainContext = createContext<ChainContextValue | null>(null);

export function ChainProvider({ children }: { children: ReactNode }) {
  const config = useConfig();
  const { chainId: externalChainId, isConnected } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();
  const [localChainId, setLocalChainId] = useState<number>(DEFAULT_CHAIN.id);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [customs, setCustoms] = useState<CustomNetwork[]>([]);
  const [switchingCustom, setSwitchingCustom] = useState(false);

  useEffect(() => {
    const loaded = loadCustomNetworks();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is an external store; loading it after mount is the SSR-safe hydration pattern
    setCustoms(loaded);
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const id = Number(saved);
        if (resolveBuiltin(id) || loaded.some((n) => n.chainId === id)) setLocalChainId(id);
      }
    } catch {
      /* storage unavailable — default chain applies */
    }
  }, []);

  const networks = useMemo<ResolvedNetwork[]>(
    () => [...BUILTIN_RESOLVED, ...customs.map(customToResolved)],
    [customs],
  );

  const resolve = (id: number): ResolvedNetwork | undefined =>
    networks.find((n) => n.chainId === id);

  const chainId = isConnected && externalChainId ? externalChainId : localChainId;
  const network = resolve(chainId) ?? null;

  const persistLocal = (id: number) => {
    setLocalChainId(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(id));
    } catch {
      /* ignore */
    }
  };

  /** Ask the external wallet to add (EIP-3085) + switch to a custom chain. */
  const switchExternalToCustom = async (target: ResolvedNetwork) => {
    const client = await getConnectorClient(config);
    // EIP-1193 provider request; cast to a generic signature because
    // wallet_addEthereumChain is not in viem's typed method map here.
    const request = client.request as (args: {
      method: string;
      params?: unknown;
    }) => Promise<unknown>;
    const params = {
      chainId: toHex(target.chainId),
      chainName: target.name,
      nativeCurrency: {
        name: target.nativeName,
        symbol: target.nativeSymbol,
        decimals: target.nativeDecimals,
      },
      rpcUrls: [target.rpcUrl],
      blockExplorerUrls: target.explorerUrl ? [target.explorerUrl] : undefined,
    };
    try {
      await request({ method: "wallet_addEthereumChain", params: [params] });
    } catch (err) {
      // Some wallets throw when the chain already exists — fall back to a
      // plain switch request before giving up.
      try {
        await request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: toHex(target.chainId) }],
        });
      } catch {
        throw err;
      }
    }
  };

  const value = useMemo<ChainContextValue>(
    () => ({
      chainId,
      network,
      networks,
      customNetworks: customs,
      external: Boolean(isConnected),
      isSwitching: isPending || switchingCustom,
      switchError,
      setChainId: (next: number) => {
        setSwitchError(null);
        const target = resolve(next);
        if (!target) {
          setSwitchError("Unsupported network.");
          return;
        }
        if (!isConnected) {
          persistLocal(next);
          return;
        }
        if (!target.custom) {
          switchChainAsync({ chainId: next }).catch((err: unknown) => {
            setSwitchError(err instanceof Error ? err.message : "Network switch was rejected.");
          });
        } else {
          setSwitchingCustom(true);
          switchExternalToCustom(target)
            .catch((err: unknown) => {
              setSwitchError(
                err instanceof Error ? err.message : "The wallet rejected the network switch.",
              );
            })
            .finally(() => setSwitchingCustom(false));
        }
      },
      addCustomNetwork: (form) => {
        const result = validateCustomNetwork(form, customs);
        if ("error" in result) return result.error;
        const next = [...customs, result.network];
        setCustoms(next);
        saveCustomNetworks(next);
        return null;
      },
      removeCustomNetwork: (id) => {
        const next = customs.filter((n) => n.chainId !== id);
        setCustoms(next);
        saveCustomNetworks(next);
        if (localChainId === id) persistLocal(DEFAULT_CHAIN.id);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chainId, network, networks, customs, isConnected, isPending, switchingCustom, switchError, localChainId, switchChainAsync, config],
  );

  return <ChainContext.Provider value={value}>{children}</ChainContext.Provider>;
}

export function useRsChain(): ChainContextValue {
  const ctx = useContext(ChainContext);
  if (!ctx) throw new Error("useRsChain must be used inside <ChainProvider>");
  return ctx;
}
