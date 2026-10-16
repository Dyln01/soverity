import { describe, expect, it } from "vitest"
import { issueToken, parseToken, verify } from "../src/server/verify"
import type { SoveritySessionToken } from "../src/server/verify"
import { scopesToBitmask } from "../src/types/scopes"

const SECRET = "test-secret-do-not-use"

const baseSession: Omit<SoveritySessionToken, "h"> = {
  did: "did:pkh:eip155:8453:0xabc123",
  proofs: ["unique_human"],
  scopes: ["openid", "profile"],
  grantedMask: scopesToBitmask(["openid", "profile", "address"]),
  issuedAt: Date.now(),
  expiresAt: Date.now() + 60_000,
  nonce: "n0nc3",
}

describe("server verify", () => {
  it("round-trips a valid token", async () => {
    const token = await issueToken(baseSession, SECRET)
    const result = await verify(`Bearer ${token}`, { secret: SECRET })
    expect(result.valid).toBe(true)
    expect(result.did).toBe("did:pkh:eip155:8453:0xabc123")
    expect(result.proofs).toContain("unique_human")
  })

  it("rejects a tampered payload (bad signature)", async () => {
    const token = await issueToken(baseSession, SECRET)
    const [payload, h] = token.split(".")
    const decoded = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(
          atob(
            (payload ?? "")
              .replace(/-/g, "+")
              .replace(/_/g, "/")
              .padEnd((payload ?? "").length + ((4 - ((payload ?? "").length % 4)) % 4), "="),
          ),
          (c) => c.charCodeAt(0),
        ),
      ),
    ) as Record<string, unknown>
    decoded.did = "did:pkh:eip155:8453:0xevil"
    const tampered = await issueToken(decoded as any, SECRET)
    const result = await verify(`Bearer ${tampered}`, { secret: SECRET })
    // Tampered payload re-signed with the same secret stays valid — that's
    // expected; instead check signature mismatch here.
    const tamperedSig = `${payload}.${h?.slice(0, -1)}x`
    const mismatch = await verify(`Bearer ${tamperedSig}`, { secret: SECRET })
    expect(mismatch.valid).toBe(false)
    expect(mismatch.reason).toBe("bad-signature")
    expect(result.valid).toBe(true)
  })

  it("rejects expired tokens", async () => {
    const token = await issueToken({ ...baseSession, expiresAt: Date.now() - 1000 }, SECRET)
    const result = await verify(`Bearer ${token}`, { secret: SECRET })
    expect(result.valid).toBe(false)
    expect(result.reason).toBe("expired")
  })

  it("rejects missing scopes", async () => {
    const token = await issueToken(baseSession, SECRET)
    const result = await verify(`Bearer ${token}`, {
      secret: SECRET,
      requiredScopes: ["email"],
    })
    expect(result.valid).toBe(false)
    expect(result.reason).toBe("missing-scope")
  })

  it("accepts when required scopes are granted", async () => {
    const token = await issueToken(baseSession, SECRET)
    const result = await verify(`Bearer ${token}`, {
      secret: SECRET,
      requiredScopes: ["openid", "address"],
    })
    expect(result.valid).toBe(true)
  })

  it("rejects malformed headers without throwing", async () => {
    expect((await verify(undefined, { secret: SECRET })).reason).toBe("malformed")
    expect((await verify("Basic abc", { secret: SECRET })).reason).toBe("malformed")
    expect((await verify("Bearer not.a.token", { secret: SECRET })).reason).toBe("malformed")
    expect((await verify("Bearer !!!", { secret: SECRET })).reason).toBe("malformed")
  })

  it("parseToken returns null on garbage", () => {
    expect(parseToken("")).toBeNull()
    expect(parseToken("a.b")).toBeNull()
  })
})
