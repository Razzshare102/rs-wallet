"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { registryTokens, type TokenInfo } from "@/lib/tokens";
import {
  addCustomToken,
  hideToken,
  isHidden,
  loadCustomTokens,
  loadHiddenTokens,
  removeCustomToken,
  unhideToken,
} from "@/lib/tokenStore";

/** The token set for a chain: curated registry + user customs, minus hidden. */
export function useTokenList(chainId: number) {
  const [customs, setCustoms] = useState<TokenInfo[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const reload = useCallback(() => {
    setCustoms(loadCustomTokens(chainId));
    setHidden(loadHiddenTokens());
  }, [chainId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is an external store; loading it after mount is the SSR-safe hydration pattern
    reload();
  }, [reload]);

  const tokens = useMemo(() => {
    const all = [...registryTokens(chainId), ...customs];
    return all.filter((t) => !isHidden(chainId, t.address, hidden));
  }, [chainId, customs, hidden]);

  const hiddenTokens = useMemo(() => {
    const all = [...registryTokens(chainId), ...customs];
    return all.filter((t) => isHidden(chainId, t.address, hidden));
  }, [chainId, customs, hidden]);

  return {
    tokens,
    hiddenTokens,
    addCustom: (token: TokenInfo) => {
      addCustomToken(chainId, token);
      reload();
    },
    removeCustom: (address: Address) => {
      removeCustomToken(chainId, address);
      reload();
    },
    hide: (address: Address) => {
      hideToken(chainId, address);
      reload();
    },
    unhide: (address: Address) => {
      unhideToken(chainId, address);
      reload();
    },
  };
}
