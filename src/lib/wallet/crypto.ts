/**
 * Vault cryptography — Web Crypto API only.
 *
 * - Key derivation: PBKDF2-HMAC-SHA256, 600,000 iterations (OWASP guidance
 *   for PBKDF2-HMAC-SHA256), 256-bit output.
 * - Encryption: AES-256-GCM with a fresh random 12-byte IV per encryption.
 * - Salt: 16 random bytes per vault.
 *
 * No secret ever leaves the device. Plaintext exists only in memory while
 * the wallet is unlocked. JavaScript cannot guarantee memory wiping — see
 * SECURITY_NOTES in the project README.
 */

export const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface EncryptedBlob {
  /** base64 ciphertext (AES-GCM, includes auth tag) */
  data: string;
  /** base64 IV */
  iv: string;
}

export interface KdfParams {
  salt: string; // base64
  iterations: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function createKdfParams(): KdfParams {
  return { salt: bytesToBase64(randomBytes(SALT_BYTES)), iterations: PBKDF2_ITERATIONS };
}

export async function deriveKey(password: string, kdf: KdfParams): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: base64ToBytes(kdf.salt) as BufferSource,
      iterations: kdf.iterations,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptText(key: CryptoKey, plaintext: string): Promise<EncryptedBlob> {
  const iv = randomBytes(IV_BYTES);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    encoder.encode(plaintext),
  );
  return { data: bytesToBase64(new Uint8Array(cipher)), iv: bytesToBase64(iv) };
}

/** Throws if the key is wrong or the data was tampered with (GCM auth tag). */
export async function decryptText(key: CryptoKey, blob: EncryptedBlob): Promise<string> {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(blob.iv) as BufferSource },
    key,
    base64ToBytes(blob.data) as BufferSource,
  );
  return decoder.decode(plain);
}

export async function encryptWithPassword(
  password: string,
  plaintext: string,
): Promise<{ kdf: KdfParams; blob: EncryptedBlob }> {
  const kdf = createKdfParams();
  const key = await deriveKey(password, kdf);
  const blob = await encryptText(key, plaintext);
  return { kdf, blob };
}

export async function decryptWithPassword(
  password: string,
  kdf: KdfParams,
  blob: EncryptedBlob,
): Promise<string> {
  const key = await deriveKey(password, kdf);
  return decryptText(key, blob);
}
