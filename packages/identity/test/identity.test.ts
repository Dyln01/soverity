import { describe, expect, it } from "vitest";
import { BASE_CHAIN_ID, didPkh, parseDid, shortDid } from "../src/did";
import { buildCredential, CREDENTIAL_TYPES, isExpired, isRevoked } from "../src/vc";
import { generateProof, verifyProof } from "../src/zk";

describe("did", () => {
  it("builds a valid did:pkh for Base", () => {
    const did = didPkh(BASE_CHAIN_ID, "0xAbC1230000000000000000000000000000000001");
    expect(did).toBe("did:pkh:eip155:8453:0xabc1230000000000000000000000000000000001");
  });

  it("rejects malformed addresses", () => {
    expect(() => didPkh(8453, "0x123")).toThrow();
  });

  it("round-trips through parseDid", () => {
    const did = didPkh(8453, "0xabc1230000000000000000000000000000000001");
    const parsed = parseDid(did);
    expect(parsed?.method).toBe("pkh");
    expect(parsed?.chainId).toBe(8453);
    expect(parsed?.address).toBe("0xabc1230000000000000000000000000000000001");
  });

  it("returns null for non-DIDs", () => {
    expect(parseDid("hello world")).toBeNull();
    expect(parseDid("did:")).toBeNull();
  });

  it("shortens for UI display", () => {
    expect(shortDid("did:pkh:eip155:8453:0xabc1230000000000000000000000000000000001")).toBe(
      "0xabc1…0001",
    );
  });
});

describe("verifiable credentials", () => {
  it("builds a W3C-shaped credential with type + context", () => {
    const vc = buildCredential("UniqueHuman", "did:pkh:eip155:8453:0xissuer", { id: "subj" });
    expect(vc.type).toEqual(["VerifiableCredential", "UniqueHuman"]);
    expect(vc["@context"]).toContain("https://www.w3.org/ns/credentials/v2");
  });

  it("respects expiry and revocation", () => {
    const expired = buildCredential("Over18", "did:x", {}, -1);
    expect(isExpired(expired)).toBe(true);
    const revoked = buildCredential("Over18", "did:x", {});
    revoked.credentialStatus = { type: "status", revoked: true };
    expect(isRevoked(revoked)).toBe(true);
  });

  it("ships the three MVP credential types with reveals", () => {
    expect(CREDENTIAL_TYPES.map((t) => t.id)).toEqual([
      "SoverityPass",
      "UniqueHuman",
      "Over18",
    ]);
    for (const t of CREDENTIAL_TYPES) {
      expect(t.reveals.length).toBeGreaterThan(0);
    }
  });
});

describe("zk proofs", () => {
  it("round-trips a predicate proof", async () => {
    const proof = await generateProof({
      claim: "unique_human",
      salt: "salty",
      attestationUid: "0xuid",
    });
    expect(proof.predicate).toBe("holds(unique_human) == true");
    const ok = await verifyProof(proof, { validCommitments: new Set([proof.commitment]) });
    expect(ok).toBe(true);
  });

  it("rejects unknown commitments and stale proofs", async () => {
    const proof = await generateProof({
      claim: "over_18",
      salt: "salty",
      attestationUid: "0xuid",
    });
    expect(await verifyProof(proof, { validCommitments: new Set() })).toBe(false);
    const stale = { ...proof, generatedAt: Date.now() - 20 * 60_000 };
    expect(await verifyProof(stale, { validCommitments: new Set([proof.commitment]) })).toBe(
      false,
    );
  });
});
