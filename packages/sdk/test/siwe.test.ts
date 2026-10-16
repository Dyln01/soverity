import { describe, expect, it } from "vitest"
import { buildSiweMessage, nowIso, randomNonce } from "../src/siwe"
import { SCOPE_BIT, scopesToBitmask } from "../src/types/scopes"

describe("siwe message", () => {
  it("builds a valid EIP-4361 message", () => {
    const message = buildSiweMessage({
      domain: "demo-dapp.vercel.app",
      address: "0xabc1230000000000000000000000000000000001",
      uri: "https://demo-dapp.vercel.app",
      version: "1",
      chainId: 8453,
      nonce: randomNonce(),
      issuedAt: nowIso(),
    })
    expect(message).toContain("wants you to sign in with your Ethereum account:")
    expect(message).toContain("URI: https://demo-dapp.vercel.app")
    expect(message).toContain("Chain ID: 8453")
    expect(message).toContain("No KYC")
  })

  it("includes scopes when requested", () => {
    const message = buildSiweMessage({
      domain: "app.example",
      address: "0xabc",
      uri: "https://app.example",
      version: "1",
      chainId: 8453,
      nonce: "n0nc3",
      issuedAt: nowIso(),
      scopes: ["openid", "profile"],
    })
    expect(message).toContain("Scopes: openid profile")
  })

  it("generates a unique 32-char nonce", () => {
    expect(randomNonce()).not.toBe(randomNonce())
    expect(randomNonce()).toHaveLength(32)
  })
})

describe("scope bitmask", () => {
  it("compiles scopes to the on-chain bitmask", () => {
    expect(scopesToBitmask(["openid"])).toBe(1)
    expect(scopesToBitmask(["openid", "profile"])).toBe(3)
    expect(scopesToBitmask([])).toBe(0)
    // every scope is a distinct bit
    const all = Object.values(SCOPE_BIT)
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        expect(all[i] & all[j]).toBe(0)
      }
    }
  })
})
