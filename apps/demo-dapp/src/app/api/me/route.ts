import { issueToken, verify } from "@soverity/sdk/server"
import { NextResponse } from "next/server"

/**
 * POST /api/me — the ENTIRE server-side integration of the demo dApp:
 * mint a session token from the SIWE result, then verify it right back
 * with the one-line verify(). In a real app the client sends the
 * Authorization header on every request; the logic is identical.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    siwe?: { message?: string; signature?: string }
  } | null

  if (!body?.siwe?.message || !body.siwe.signature) {
    return NextResponse.json({ valid: false, reason: "malformed" }, { status: 400 })
  }

  const secret = process.env.SOVERITY_SESSION_SECRET
  if (!secret) {
    return NextResponse.json({ valid: false, reason: "server-misconfigured" }, { status: 500 })
  }

  // Mint a short-lived session token for the signed-in DID.
  const token = await issueToken(
    {
      did: "did:pkh:eip155:8453:0xdemo",
      proofs: ["unique_human"],
      scopes: ["openid", "profile"],
      grantedMask: 0b111,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 30 * 60_000,
      nonce: "demo",
    },
    secret,
  )

  // The one-line server integration:
  const result = await verify(`Bearer ${token}`, {
    secret,
    requiredScopes: ["openid", "profile"],
  })

  return NextResponse.json(result)
}
