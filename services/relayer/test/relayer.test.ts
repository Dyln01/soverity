import { describe, expect, it } from "vitest"
import { buildServer } from "../src/server"

process.env.RELAYER_ALLOWED_TARGETS = "0xregistry,0xpermissions"

describe("relayer", () => {
  it("health says ok", async () => {
    const res = await buildServer().inject({ method: "GET", url: "/health" })
    expect(res.json()).toEqual({ ok: true, sponsored: true })
  })

  it("accepts a valid sponsored intent", async () => {
    const res = await buildServer().inject({
      method: "POST",
      url: "/relay",
      payload: { did: "did:pkh:eip155:8453:0xabc", target: "0xRegistry", userOp: { nonce: 1 } },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().sponsored).toBe(true)
  })

  it("rejects non-allowlisted targets", async () => {
    const res = await buildServer().inject({
      method: "POST",
      url: "/relay",
      payload: { did: "did:pkh:1", target: "0xattacker", userOp: {} },
    })
    expect(res.statusCode).toBe(403)
  })

  it("rate limits per DID", async () => {
    const app = buildServer()
    for (let i = 0; i < 22; i++) {
      await app.inject({
        method: "POST",
        url: "/relay",
        payload: { did: "did:pkh:spammer", target: "0xregistry", userOp: {} },
      })
    }
    const res = await app.inject({
      method: "POST",
      url: "/relay",
      payload: { did: "did:pkh:spammer", target: "0xregistry", userOp: {} },
    })
    expect(res.statusCode).toBe(429)
  })
})
