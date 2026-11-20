import { get, set, del } from "idb-keyval";
import {
  decryptText,
  deriveKey,
  encryptText,
  encryptWithPassword,
  type EncryptedBlob,
  type KdfParams,
} from "./crypto";

/**
 * Encrypted vault storage (spec §4).
 *
 * IndexedDB stores ONLY: the AES-256-GCM ciphertext of the vault payload,
 * the KDF salt + iteration count, the GCM IV, and non-sensitive metadata.
 * Plaintext phrases, keys and passwords are never persisted anywhere.
 */

const VAULT_KEY = "rs-wallet:vault:v1";

export type AccountId = string; // "hd:0" | "pk:<uuid>"

export interface ImportedKeyEntry {
  id: string; // uuid — account id is `pk:${id}`
  name: string;
  privateKey: `0x${string}`;
}

export interface VaultPayload {
  version: 1;
  /** BIP-39 phrase for HD accounts, or null for private-key-only wallets. */
  mnemonic: string | null;
  /** Number of derived HD accounts (indices 0..hdAccountCount-1). */
  hdAccountCount: number;
  importedKeys: ImportedKeyEntry[];
  /** accountId → display name overrides */
  names: Record<string, string>;
  activeAccountId: AccountId;
  createdAt: number;
}

export interface VaultRecord {
  version: 1;
  kdf: KdfParams;
  blob: EncryptedBlob;
  createdAt: number;
  updatedAt: number;
}

export async function loadVaultRecord(): Promise<VaultRecord | null> {
  try {
    const record = await get<VaultRecord>(VAULT_KEY);
    return record ?? null;
  } catch {
    return null;
  }
}

export async function vaultExists(): Promise<boolean> {
  return (await loadVaultRecord()) !== null;
}

async function saveVaultRecord(record: VaultRecord): Promise<void> {
  await set(VAULT_KEY, record);
}

export async function createVault(password: string, payload: VaultPayload): Promise<void> {
  const { kdf, blob } = await encryptWithPassword(password, JSON.stringify(payload));
  const now = Date.now();
  await saveVaultRecord({ version: 1, kdf, blob, createdAt: now, updatedAt: now });
}

/** Throws on wrong password (AES-GCM authentication failure). */
export async function unlockVault(password: string): Promise<VaultPayload> {
  const { payload } = await openVault(password);
  return payload;
}

/**
 * Unlocks and returns both the payload and the session CryptoKey.
 * The key (never the password) is what the app holds in memory while
 * unlocked, so later payload updates can be re-encrypted without asking
 * for the password again.
 */
export async function openVault(
  password: string,
): Promise<{ payload: VaultPayload; key: CryptoKey; record: VaultRecord }> {
  const record = await loadVaultRecord();
  if (!record) throw new Error("No wallet found on this device.");
  const key = await deriveKey(password, record.kdf);
  const plaintext = await decryptText(key, record.blob);
  const payload = JSON.parse(plaintext) as VaultPayload;
  if (payload.version !== 1) throw new Error("Unsupported vault version.");
  return { payload, key, record };
}

/** Re-encrypts an updated payload with the session key (fresh IV). */
export async function persistPayload(key: CryptoKey, payload: VaultPayload): Promise<void> {
  const record = await loadVaultRecord();
  if (!record) throw new Error("No wallet found on this device.");
  const blob = await encryptText(key, JSON.stringify(payload));
  await saveVaultRecord({ ...record, blob, updatedAt: Date.now() });
}

/** Password check used before sensitive operations (export key, etc.). */
export async function verifyPassword(password: string): Promise<boolean> {
  try {
    await unlockVault(password);
    return true;
  } catch {
    return false;
  }
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  const payload = await unlockVault(oldPassword); // throws if old password is wrong
  await createVault(newPassword, payload);
}

/** Permanently removes the vault from this device. Irreversible. */
export async function deleteVault(): Promise<void> {
  await del(VAULT_KEY);
}

export function defaultAccountName(id: AccountId, payload: VaultPayload): string {
  if (payload.names[id]) return payload.names[id];
  if (id.startsWith("hd:")) return `Account ${Number(id.slice(3)) + 1}`;
  const entry = payload.importedKeys.find((k) => `pk:${k.id}` === id);
  return entry?.name ?? "Imported account";
}
