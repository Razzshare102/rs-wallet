import type { Address } from "viem";
import type { TokenInfo } from "./tokens";

/**
 * User-added custom tokens and hidden tokens, per chain.
 * Stored in localStorage: token metadata is public information (contract
 * address, name, symbol, decimals) — never secrets.
 */

const CUSTOM_KEY = "rs-wallet:custom-tokens";
const HIDDEN_KEY = "rs-wallet:hidden-tokens";

type CustomMap = Record<string, TokenInfo[]>;

function readCustom(): CustomMap {
  try {
    const raw = window.localStorage.getItem(CUSTOM_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CustomMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeCustom(map: CustomMap): void {
  try {
    window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function loadCustomTokens(chainId: number): TokenInfo[] {
  return readCustom()[String(chainId)] ?? [];
}

export function addCustomToken(chainId: number, token: TokenInfo): void {
  const map = readCustom();
  const list = map[String(chainId)] ?? [];
  if (list.some((t) => t.address.toLowerCase() === token.address.toLowerCase())) return;
  map[String(chainId)] = [...list, token];
  writeCustom(map);
}

export function removeCustomToken(chainId: number, address: Address): void {
  const map = readCustom();
  const list = map[String(chainId)] ?? [];
  map[String(chainId)] = list.filter((t) => t.address.toLowerCase() !== address.toLowerCase());
  writeCustom(map);
}

function hiddenKey(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`;
}

function readHidden(): string[] {
  try {
    const raw = window.localStorage.getItem(HIDDEN_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadHiddenTokens(): Set<string> {
  return new Set(readHidden());
}

export function hideToken(chainId: number, address: string): void {
  const hidden = new Set(readHidden());
  hidden.add(hiddenKey(chainId, address));
  try {
    window.localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden]));
  } catch {
    /* ignore */
  }
}

export function unhideToken(chainId: number, address: string): void {
  const hidden = new Set(readHidden());
  hidden.delete(hiddenKey(chainId, address));
  try {
    window.localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden]));
  } catch {
    /* ignore */
  }
}

export function isHidden(chainId: number, address: string, hidden: Set<string>): boolean {
  return hidden.has(hiddenKey(chainId, address));
}
