/**
 * Encrypted storage — the user's passport vault.
 *
 * Profile/credential blobs are AES-GCM encrypted client-side before they
 * touch storage. Production wiring: Ceramic (mutable profile), IPFS or
 * Arweave (immutable snapshots), Lit Protocol (distributed key holding
 * the ACL). This module implements the encryption + ACL interface and an
 * IndexedDB driver so the MVP works fully offline.
 */

export interface EncryptedBlob {
  ciphertext: string; // base64url
  iv: string; // base64url
  createdAt: number;
}

function b64u(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromB64u(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encrypt(key: CryptoKey, plaintext: string): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return { ciphertext: b64u(new Uint8Array(ct)), iv: b64u(iv), createdAt: Date.now() };
}

export async function decrypt(key: CryptoKey, blob: EncryptedBlob): Promise<string> {
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64u(blob.iv) },
    key,
    fromB64u(blob.ciphertext),
  );
  return new TextDecoder().decode(pt);
}

/** Derive the vault key from the passkey ceremony output. */
export async function deriveVaultKey(credentialId: string): Promise<CryptoKey> {
  const seed = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(credentialId));
  return crypto.subtle.importKey("raw", seed, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** IndexedDB driver — the local, private half of the storage layer. */
const DB_NAME = "soverity-vault";
const STORE = "blobs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putBlob(id: string, blob: EncryptedBlob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getBlob(id: string): Promise<EncryptedBlob | null> {
  const db = await openDb();
  const result = await new Promise<EncryptedBlob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

export async function deleteBlob(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Export the entire passport (encrypted) — the user owns everything. */
export async function exportVault(ids: string[]): Promise<Record<string, EncryptedBlob>> {
  const out: Record<string, EncryptedBlob> = {};
  for (const id of ids) {
    const blob = await getBlob(id);
    if (blob) out[id] = blob;
  }
  return out;
}
