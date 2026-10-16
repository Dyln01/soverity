import { NextResponse } from "next/server"

/**
 * POST /api/pass — register a new Soverity Pass.
 *
 * The wallet + DID are derived CLIENT-SIDE from the passkey; this endpoint
 * only registers the (username, avatar, credential-id) tuple and returns the
 * pass reference. In the full architecture this writes to SoverityRegistry
 * on Base via the relayer (gasless for the user); in the MVP it writes the
 * local dev registry — the API shape is identical.
 */

// dev-only in-memory registry (per serverless instance). The chain is the
// source of truth in production; this exists so the flow works offline.
const registry = new Map<string, { username: string; avatar: string | null }>()

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    username?: string
    avatar?: string | null
    credential?: string
  } | null

  if (!body?.username || !body.credential) {
    return NextResponse.json({ error: "username and credential are required" }, { status: 400 })
  }

  const username = String(body.username).toLowerCase()
  if (!/^[a-z0-9_]{3,32}$/.test(username)) {
    return NextResponse.json({ error: "invalid username format" }, { status: 400 })
  }
  if (registry.has(username)) {
    return NextResponse.json({ error: "username already claimed" }, { status: 409 })
  }

  registry.set(username, { username, avatar: body.avatar ?? null })

  // Deterministic pseudonymous DID for the MVP: real builds derive
  // did:pkh from the ERC-4337 account address.
  const did = `did:pkh:eip155:8453:soverity-${username}`

  return NextResponse.json({
    did,
    username,
    avatar: body.avatar ?? null,
    createdAt: Date.now(),
  })
}
