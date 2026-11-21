/**
 * Passkey unlock for the built-in vault (WebAuthn PRF).
 *
 * How it works: the authenticator's PRF extension returns a secret that
 * never leaves the authenticator (Face ID / fingerprint / Windows Hello /
 * security key). That secret is used as an AES-GCM key to encrypt the
 * wallet password. The ciphertext, credential id and PRF salt are stored
 * in localStorage — without the physical passkey they are useless, and
 * the password remains the master secret that encrypts the vault itself.
 *
 * Passkey unlock is therefore a convenience for THIS device and browser
 * only. Losing the passkey never loses the wallet: the password and the
 * recovery phrase keep working.
 */

const STORAGE_KEY = "rs-wallet:passkey:v1";

interface PasskeyRecord {
  credentialId: string; // base64url
  salt: string; // base64url — PRF eval input, not secret
  iv: string; // base64url
  ciphertext: string; // base64url — the wallet password, AES-GCM under the PRF secret
  createdAt: number;
}

function toB64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return arr;
}

function readRecord(): PasskeyRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PasskeyRecord;
    if (!parsed.credentialId || !parsed.salt || !parsed.iv || !parsed.ciphertext) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasPasskey(): boolean {
  return typeof window !== "undefined" && readRecord() !== null;
}

export async function passkeyPlatformAvailable(): Promise<boolean> {
  if (typeof window === "undefined" || !("PublicKeyCredential" in window)) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function passkeyBrowserSupported(): boolean {
  return typeof window !== "undefined" && "PublicKeyCredential" in window && !!navigator.credentials;
}

interface PrfResults {
  prf?: { results?: { first?: ArrayBuffer } };
}

function prfOutput(credential: PublicKeyCredential): ArrayBuffer | null {
  const results = credential.getClientExtensionResults() as PrfResults;
  return results.prf?.results?.first ?? null;
}

async function importPrfKey(prf: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", prf, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function friendlyError(err: unknown): Error {
  if (err instanceof DOMException && err.name === "NotAllowedError") {
    return new Error("The passkey prompt was cancelled or timed out.");
  }
  if (err instanceof Error) return err;
  return new Error("Passkey operation failed.");
}

const PRF_UNSUPPORTED =
  "This browser or authenticator does not support the passkey PRF feature RS WALLET needs for passkey unlock. Try Chrome or Edge with a platform passkey (Face ID, fingerprint, Windows Hello).";

/** Creates a passkey and stores the wallet password encrypted under its PRF secret. Caller must verify the password first. */
export async function enablePasskey(password: string): Promise<void> {
  if (!passkeyBrowserSupported()) throw new Error("This browser does not support passkeys.");
  const salt = randomBytes(32);
  const prfExtensions = { prf: { eval: { first: salt } } };

  let credential: PublicKeyCredential;
  try {
    const created = await navigator.credentials.create({
      publicKey: {
        challenge: randomBytes(32),
        rp: { id: window.location.hostname, name: "RS WALLET" },
        user: {
          id: randomBytes(16),
          name: "rs-wallet",
          displayName: "RS WALLET",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, // ES256
          { type: "public-key", alg: -257 }, // RS256
        ],
        authenticatorSelection: { residentKey: "required", userVerification: "required" },
        timeout: 120_000,
        extensions: prfExtensions as AuthenticationExtensionsClientInputs,
      },
    });
    if (!(created instanceof PublicKeyCredential)) throw new Error("Passkey creation failed.");
    credential = created;
  } catch (err) {
    throw friendlyError(err);
  }

  let prf = prfOutput(credential);
  if (!prf) {
    // Some browsers only return the PRF result on assertion, not on creation.
    try {
      const asserted = await navigator.credentials.get({
        publicKey: {
          challenge: randomBytes(32),
          rpId: window.location.hostname,
          allowCredentials: [{ type: "public-key", id: credential.rawId }],
          userVerification: "required",
          timeout: 120_000,
          extensions: prfExtensions as AuthenticationExtensionsClientInputs,
        },
      });
      if (asserted instanceof PublicKeyCredential) prf = prfOutput(asserted);
    } catch (err) {
      throw friendlyError(err);
    }
  }
  if (!prf) throw new Error(PRF_UNSUPPORTED);

  const key = await importPrfKey(prf);
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(password),
  );
  const record: PasskeyRecord = {
    credentialId: toB64Url(credential.rawId),
    salt: toB64Url(salt),
    iv: toB64Url(iv),
    ciphertext: toB64Url(ciphertext),
    createdAt: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

/** Runs the passkey prompt and returns the decrypted wallet password. */
export async function unlockWithPasskey(): Promise<string> {
  const record = readRecord();
  if (!record) throw new Error("No passkey is set up on this device.");
  const salt = fromB64Url(record.salt);
  let assertion: PublicKeyCredential;
  try {
    const result = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        rpId: window.location.hostname,
        allowCredentials: [{ type: "public-key", id: fromB64Url(record.credentialId) as BufferSource }],
        userVerification: "required",
        timeout: 120_000,
        extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs,
      },
    });
    if (!(result instanceof PublicKeyCredential)) throw new Error("Passkey prompt failed.");
    assertion = result;
  } catch (err) {
    throw friendlyError(err);
  }
  const prf = prfOutput(assertion);
  if (!prf) throw new Error(PRF_UNSUPPORTED);
  const key = await importPrfKey(prf);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64Url(record.iv) as BufferSource },
      key,
      fromB64Url(record.ciphertext) as BufferSource,
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error("The stored passkey data could not be decrypted. Unlock with your password and set up the passkey again.");
  }
}

export function disablePasskey(): void {
  localStorage.removeItem(STORAGE_KEY);
}
