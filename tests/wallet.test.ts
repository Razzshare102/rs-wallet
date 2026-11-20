import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  decryptWithPassword,
  encryptWithPassword,
  PBKDF2_ITERATIONS,
} from "@/lib/wallet/crypto";
import {
  accountFromPrivateKey,
  deriveHdAccount,
  deriveHdPrivateKey,
  generateRecoveryPhrase,
  isValidAddress,
  isValidPrivateKey,
  isValidRecoveryPhrase,
  normalizePhrase,
} from "@/lib/wallet/accounts";
import {
  createVault,
  deleteVault,
  openVault,
  persistPayload,
  unlockVault,
  vaultExists,
  verifyPassword,
  type VaultPayload,
} from "@/lib/wallet/vault";

// The canonical BIP-39 test phrase ("abandon" x11 + "about") and its
// well-known first Ethereum account at m/44'/60'/0'/0/0.
const TEST_PHRASE =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const TEST_ADDRESS = "0x9858EfFD232B4033E47d90003D41EC34EcaEda94";

describe("vault cryptography (AES-256-GCM + PBKDF2)", () => {
  it("uses 600,000 PBKDF2 iterations", () => {
    expect(PBKDF2_ITERATIONS).toBe(600_000);
  });

  it("encrypts and decrypts a roundtrip", async () => {
    const { kdf, blob } = await encryptWithPassword("correct horse battery", "secret payload");
    expect(blob.data).not.toContain("secret payload");
    await expect(decryptWithPassword("correct horse battery", kdf, blob)).resolves.toBe(
      "secret payload",
    );
  });

  it("rejects a wrong password", async () => {
    const { kdf, blob } = await encryptWithPassword("right-password", "secret payload");
    await expect(decryptWithPassword("wrong-password", kdf, blob)).rejects.toThrow();
  });

  it("rejects tampered ciphertext", async () => {
    const { kdf, blob } = await encryptWithPassword("pw123456", "secret payload");
    const tampered = { ...blob, data: blob.data.slice(0, -4) + "AAAA" };
    await expect(decryptWithPassword("pw123456", kdf, tampered)).rejects.toThrow();
  });

  it("produces a fresh IV per encryption", async () => {
    const a = await encryptWithPassword("pw123456", "same input");
    const b = await encryptWithPassword("pw123456", "same input");
    expect(a.blob.iv).not.toBe(b.blob.iv);
    expect(a.blob.data).not.toBe(b.blob.data);
  });
});

describe("recovery phrases and derivation", () => {
  it("generates valid 12-word phrases", () => {
    const phrase = generateRecoveryPhrase();
    expect(phrase.split(" ")).toHaveLength(12);
    expect(isValidRecoveryPhrase(phrase)).toBe(true);
  });

  it("validates the canonical test phrase and rejects garbage", () => {
    expect(isValidRecoveryPhrase(TEST_PHRASE)).toBe(true);
    expect(isValidRecoveryPhrase("abandon abandon abandon")).toBe(false);
    expect(isValidRecoveryPhrase("not a real phrase at all not a real phrase ok")).toBe(false);
    expect(isValidRecoveryPhrase("")).toBe(false);
  });

  it("normalizes whitespace and case", () => {
    expect(normalizePhrase("  Abandon   ABANDON\nabout ")).toBe("abandon abandon about");
    expect(isValidRecoveryPhrase(`  ${TEST_PHRASE.toUpperCase()} `)).toBe(true);
  });

  it("derives the known first account for the test phrase", () => {
    const account = deriveHdAccount(TEST_PHRASE, 0);
    expect(account.address).toBe(TEST_ADDRESS);
  });

  it("derives different accounts at different indices", () => {
    const a = deriveHdAccount(TEST_PHRASE, 0);
    const b = deriveHdAccount(TEST_PHRASE, 1);
    expect(a.address).not.toBe(b.address);
  });

  it("HD private key export matches the derived account", () => {
    const key = deriveHdPrivateKey(TEST_PHRASE, 0);
    expect(isValidPrivateKey(key)).toBe(true);
    expect(accountFromPrivateKey(key).address).toBe(TEST_ADDRESS);
  });
});

describe("private keys and addresses", () => {
  it("validates private key format", () => {
    expect(isValidPrivateKey(`0x${"1".repeat(64)}`)).toBe(true);
    expect(isValidPrivateKey("1".repeat(64))).toBe(false); // missing 0x
    expect(isValidPrivateKey("0x1234")).toBe(false);
    expect(isValidPrivateKey("")).toBe(false);
  });

  it("validates EVM addresses including checksum rules", () => {
    expect(isValidAddress(TEST_ADDRESS)).toBe(true);
    expect(isValidAddress(TEST_ADDRESS.toLowerCase())).toBe(true);
    expect(isValidAddress("0x9858EffD232B4033E47d90003D41EC34EcaEda94")).toBe(false); // mixed case, bad checksum
    expect(isValidAddress("0x123")).toBe(false);
    expect(isValidAddress("not-an-address")).toBe(false);
  });
});

describe("encrypted vault storage (IndexedDB)", () => {
  const payload: VaultPayload = {
    version: 1,
    mnemonic: TEST_PHRASE,
    hdAccountCount: 1,
    importedKeys: [],
    names: {},
    activeAccountId: "hd:0",
    createdAt: 1_700_000_000_000,
  };

  it("creates, unlocks and re-encrypts a vault", async () => {
    await deleteVault();
    expect(await vaultExists()).toBe(false);

    await createVault("vault-password-1", payload);
    expect(await vaultExists()).toBe(true);

    const opened = await unlockVault("vault-password-1");
    expect(opened.mnemonic).toBe(TEST_PHRASE);
    expect(opened.activeAccountId).toBe("hd:0");

    await expect(unlockVault("wrong-password")).rejects.toThrow();
    expect(await verifyPassword("vault-password-1")).toBe(true);
    expect(await verifyPassword("nope-nope")).toBe(false);

    const { key } = await openVault("vault-password-1");
    await persistPayload(key, { ...payload, hdAccountCount: 3 });
    const updated = await unlockVault("vault-password-1");
    expect(updated.hdAccountCount).toBe(3);

    await deleteVault();
    expect(await vaultExists()).toBe(false);
  });
});
