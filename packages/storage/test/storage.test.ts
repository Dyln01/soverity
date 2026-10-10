import { describe, expect, it } from "vitest";
import { decrypt, deriveVaultKey, encrypt } from "../src";

describe("encrypted vault", () => {
  it("round-trips AES-GCM encryption", async () => {
    const key = await deriveVaultKey("cred-123");
    const secret = JSON.stringify({ did: "did:pkh:eip155:8453:0xabc", credentials: [] });
    const blob = await encrypt(key, secret);
    expect(blob.ciphertext).not.toContain("did:pkh");
    expect(await decrypt(key, blob)).toBe(secret);
  });

  it("fails to decrypt with the wrong key", async () => {
    const keyA = await deriveVaultKey("cred-A");
    const keyB = await deriveVaultKey("cred-B");
    const blob = await encrypt(keyA, "top secret");
    await expect(decrypt(keyB, blob)).rejects.toThrow();
  });

  it("uses a fresh IV per encryption (semantic security)", async () => {
    const key = await deriveVaultKey("cred-1");
    const a = await encrypt(key, "same plaintext");
    const b = await encrypt(key, "same plaintext");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });
});
