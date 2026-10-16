import type { Scope } from "./scopes"

/**
 * The three display fields a detection hint is allowed to carry.
 * Everything else (DID, address, credentials, email) stays hidden until
 * the user approves. The button is a preview, not a handshake.
 */
export interface SoverityHint {
  avatarUrl: string
  username: string
  ensName?: string
}

export interface SoveritySession {
  /** W3C DID, e.g. did:pkh:eip155:8453:0xabc… */
  did: string
  /** Optional address reveal — only present when the `address` scope was granted. */
  address?: string
  /** Proofs the user chose to share (e.g. "unique_human"). */
  proofs: string[]
  scopes: Scope[]
  issuedAt: number
  expiresAt: number
}

export type ButtonState = "detecting" | "none" | "last-used" | "multi"

export interface DetectedAccount extends SoverityHint {
  /** Stable id for list keys; never leaves the browser. */
  id: string
  lastUsed: boolean
}

export interface SignInSuccess {
  session: SoveritySession
  /** SIWE message + signature pair, ready for server-side verify. */
  siwe: { message: string; signature: string }
}

export type SignInResult = SignInSuccess | null
