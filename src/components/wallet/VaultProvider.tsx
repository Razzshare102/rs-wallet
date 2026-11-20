"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Hex } from "viem";
import type { LocalAccount } from "viem/accounts";
import {
  accountFromPrivateKey,
  deriveHdAccount,
  deriveHdPrivateKey,
} from "@/lib/wallet/accounts";
import {
  createVault,
  defaultAccountName,
  deleteVault,
  openVault,
  persistPayload,
  vaultExists,
  verifyPassword as verifyVaultPassword,
  type AccountId,
  type VaultPayload,
} from "@/lib/wallet/vault";

export type VaultStatus = "loading" | "no-vault" | "locked" | "unlocked";

export interface AccountInfo {
  id: AccountId;
  name: string;
  address: `0x${string}`;
  kind: "hd" | "imported";
}

interface PendingSetup {
  mnemonic: string;
  password: string;
}

interface VaultContextValue {
  status: VaultStatus;
  accounts: AccountInfo[];
  activeAccount: AccountInfo | null;
  hasMnemonic: boolean;
  autoLockMinutes: number;
  setAutoLockMinutes: (minutes: number) => void;
  // Onboarding (in-memory only — never persisted)
  pendingSetup: PendingSetup | null;
  setPendingSetup: (setup: PendingSetup | null) => void;
  completeSetup: () => Promise<void>;
  initializeVault: (payload: VaultPayload, password: string) => Promise<void>;
  // Session
  unlock: (password: string) => Promise<void>;
  lock: () => void;
  refresh: () => Promise<void>;
  deleteWallet: () => Promise<void>;
  // Accounts (require unlocked)
  addHdAccount: () => Promise<AccountInfo>;
  importPrivateKey: (privateKey: Hex, name?: string) => Promise<AccountInfo>;
  renameAccount: (id: AccountId, name: string) => Promise<void>;
  setActiveAccountId: (id: AccountId) => Promise<void>;
  // Secrets (require unlocked; export additionally requires password re-verification by the caller)
  getLocalAccount: (id: AccountId) => LocalAccount | null;
  exportPrivateKey: (id: AccountId) => Hex | null;
  revealMnemonic: () => string | null;
  verifyPassword: (password: string) => Promise<boolean>;
}

const VaultContext = createContext<VaultContextValue | null>(null);
const AUTOLOCK_KEY = "rs-wallet:autolock-minutes";
export const AUTOLOCK_OPTIONS = [1, 5, 15, 30] as const;

function buildAccounts(payload: VaultPayload): AccountInfo[] {
  const list: AccountInfo[] = [];
  if (payload.mnemonic) {
    for (let i = 0; i < payload.hdAccountCount; i++) {
      const id = `hd:${i}`;
      list.push({
        id,
        name: defaultAccountName(id, payload),
        address: deriveHdAccount(payload.mnemonic, i).address,
        kind: "hd",
      });
    }
  }
  for (const entry of payload.importedKeys) {
    const id = `pk:${entry.id}`;
    list.push({
      id,
      name: defaultAccountName(id, payload),
      address: accountFromPrivateKey(entry.privateKey).address,
      kind: "imported",
    });
  }
  return list;
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<VaultStatus>("loading");
  const [payload, setPayload] = useState<VaultPayload | null>(null);
  const [pendingSetup, setPendingSetup] = useState<PendingSetup | null>(null);
  const [autoLockMinutes, setAutoLockMinutesState] = useState<number>(5);
  const keyRef = useRef<CryptoKey | null>(null);
  // Initialized lazily in effects/handlers — calling Date.now() during
  // render is rejected by Next 16 prerendering (Cache Components).
  const lastActivityRef = useRef<number>(0);

  const refresh = useCallback(async () => {
    const exists = await vaultExists();
    if (!exists) {
      setStatus("no-vault");
      setPayload(null);
      keyRef.current = null;
    } else if (!keyRef.current) {
      setStatus("locked");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- vault status is read from IndexedDB (an external store) after mount
    void refresh();
    try {
      const saved = Number(window.localStorage.getItem(AUTOLOCK_KEY));
      if (saved === 0 || AUTOLOCK_OPTIONS.includes(saved as (typeof AUTOLOCK_OPTIONS)[number])) {
        setAutoLockMinutesState(saved);
      }
    } catch {
      /* default applies */
    }
  }, [refresh]);

  const lock = useCallback(() => {
    keyRef.current = null;
    setPayload(null);
    setPendingSetup(null);
    setStatus((prev) => (prev === "unlocked" ? "locked" : prev));
  }, []);

  // Inactivity auto-lock (spec §4). Activity resets the timer; the wallet
  // locks after the configured idle period.
  useEffect(() => {
    if (status !== "unlocked" || autoLockMinutes <= 0) return;
    const bump = () => {
      lastActivityRef.current = Date.now();
    };
    window.addEventListener("pointerdown", bump);
    window.addEventListener("keydown", bump);
    const timer = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current > autoLockMinutes * 60_000) lock();
    }, 15_000);
    return () => {
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
      window.clearInterval(timer);
    };
  }, [status, autoLockMinutes, lock]);

  const setAutoLockMinutes = useCallback((minutes: number) => {
    setAutoLockMinutesState(minutes);
    try {
      window.localStorage.setItem(AUTOLOCK_KEY, String(minutes));
    } catch {
      /* ignore */
    }
  }, []);

  const applyPayload = useCallback(async (next: VaultPayload) => {
    if (!keyRef.current) throw new Error("Wallet is locked.");
    await persistPayload(keyRef.current, next);
    setPayload(next);
  }, []);

  const unlock = useCallback(async (password: string) => {
    const { payload: opened, key } = await openVault(password);
    keyRef.current = key;
    setPayload(opened);
    lastActivityRef.current = Date.now();
    setStatus("unlocked");
  }, []);

  const initializeVault = useCallback(
    async (newPayload: VaultPayload, password: string) => {
      await createVault(password, newPayload);
      await unlock(password);
    },
    [unlock],
  );

  const completeSetup = useCallback(async () => {
    if (!pendingSetup) throw new Error("No pending wallet setup.");
    const payload: VaultPayload = {
      version: 1,
      mnemonic: pendingSetup.mnemonic,
      hdAccountCount: 1,
      importedKeys: [],
      names: {},
      activeAccountId: "hd:0",
      createdAt: Date.now(),
    };
    await initializeVault(payload, pendingSetup.password);
    setPendingSetup(null);
  }, [pendingSetup, initializeVault]);

  const deleteWallet = useCallback(async () => {
    await deleteVault();
    keyRef.current = null;
    setPayload(null);
    setStatus("no-vault");
  }, []);

  const accounts = useMemo(() => (payload ? buildAccounts(payload) : []), [payload]);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === payload?.activeAccountId) ?? accounts[0] ?? null,
    [accounts, payload],
  );

  const value: VaultContextValue = {
    status,
    accounts,
    activeAccount,
    hasMnemonic: Boolean(payload?.mnemonic),
    autoLockMinutes,
    setAutoLockMinutes,
    pendingSetup,
    setPendingSetup,
    completeSetup,
    initializeVault,
    unlock,
    lock,
    refresh,
    deleteWallet,
    addHdAccount: async () => {
      if (!payload?.mnemonic) throw new Error("This wallet has no recovery phrase to derive from.");
      const index = payload.hdAccountCount;
      const next: VaultPayload = {
        ...payload,
        hdAccountCount: index + 1,
        activeAccountId: `hd:${index}`,
      };
      await applyPayload(next);
      return {
        id: `hd:${index}`,
        name: defaultAccountName(`hd:${index}`, next),
        address: deriveHdAccount(payload.mnemonic, index).address,
        kind: "hd" as const,
      };
    },
    importPrivateKey: async (privateKey, name) => {
      if (!payload) throw new Error("Wallet is locked.");
      const account = accountFromPrivateKey(privateKey);
      if (accounts.some((a) => a.address.toLowerCase() === account.address.toLowerCase())) {
        throw new Error("That private key is already in this wallet.");
      }
      const id = crypto.randomUUID();
      const entry = { id, name: name?.trim() || `Imported ${payload.importedKeys.length + 1}`, privateKey };
      const next: VaultPayload = {
        ...payload,
        importedKeys: [...payload.importedKeys, entry],
        activeAccountId: `pk:${id}`,
      };
      await applyPayload(next);
      return { id: `pk:${id}`, name: entry.name, address: account.address, kind: "imported" as const };
    },
    renameAccount: async (id, name) => {
      if (!payload) throw new Error("Wallet is locked.");
      await applyPayload({ ...payload, names: { ...payload.names, [id]: name.trim() } });
    },
    setActiveAccountId: async (id) => {
      if (!payload) throw new Error("Wallet is locked.");
      await applyPayload({ ...payload, activeAccountId: id });
    },
    getLocalAccount: (id) => {
      if (!payload) return null;
      if (id.startsWith("hd:") && payload.mnemonic) {
        return deriveHdAccount(payload.mnemonic, Number(id.slice(3)));
      }
      const entry = payload.importedKeys.find((k) => `pk:${k.id}` === id);
      return entry ? accountFromPrivateKey(entry.privateKey) : null;
    },
    exportPrivateKey: (id) => {
      if (!payload) return null;
      if (id.startsWith("hd:") && payload.mnemonic) {
        return deriveHdPrivateKey(payload.mnemonic, Number(id.slice(3)));
      }
      const entry = payload.importedKeys.find((k) => `pk:${k.id}` === id);
      return entry?.privateKey ?? null;
    },
    revealMnemonic: () => payload?.mnemonic ?? null,
    verifyPassword: (password) => verifyVaultPassword(password),
  };

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used inside <VaultProvider>");
  return ctx;
}
