import { generateMnemonic, validateMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { HDKey } from "@scure/bip32";
import { mnemonicToAccount, privateKeyToAccount, type LocalAccount } from "viem/accounts";
import { isAddress, isHex, type Hex } from "viem";

/**
 * Account derivation — audited libraries only (@scure/bip39, @scure/bip32,
 * viem accounts). No hand-rolled cryptography.
 *
 * HD path: BIP-44 m/44'/60'/0'/0/{index} (the Ethereum standard path used
 * by viem's mnemonicToAccount).
 */

export function generateRecoveryPhrase(): string {
  // 128 bits of entropy → 12 words, generated with the platform CSPRNG
  // inside @scure/bip39.
  return generateMnemonic(wordlist, 128);
}

export function normalizePhrase(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isValidRecoveryPhrase(input: string): boolean {
  const phrase = normalizePhrase(input);
  const words = phrase.split(" ").filter(Boolean);
  if (words.length !== 12 && words.length !== 24) return false;
  return validateMnemonic(phrase, wordlist);
}

export function deriveHdAccount(mnemonic: string, index: number): LocalAccount {
  return mnemonicToAccount(mnemonic, { addressIndex: index });
}

/** Derive the private key for an HD index (used for export, behind password re-verification). */
export function deriveHdPrivateKey(mnemonic: string, index: number): Hex {
  const seed = mnemonicToSeedSync(normalizePhrase(mnemonic));
  const hd = HDKey.fromMasterSeed(seed).derive(`m/44'/60'/0'/0/${index}`);
  if (!hd.privateKey) throw new Error("Failed to derive private key.");
  const hex = Array.from(hd.privateKey, (b) => b.toString(16).padStart(2, "0")).join("");
  return `0x${hex}` as Hex;
}

export function isValidPrivateKey(input: string): boolean {
  const key = input.trim();
  return isHex(key) && key.length === 66;
}

export function accountFromPrivateKey(privateKey: Hex): LocalAccount {
  return privateKeyToAccount(privateKey);
}

export function isValidAddress(input: string): boolean {
  return isAddress(input.trim());
}
