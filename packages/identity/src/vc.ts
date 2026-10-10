/**
 * Verifiable Credential helpers (W3C VC Data Model v2, minimal subset).
 *
 * Credentials are JSON documents signed (JWS-style, detached) by an
 * issuer. The MVP signs with a symmetric HMAC for dev issuance and
 * leaves secp256k1/Ed25519 production signing behind the same interface.
 */

export interface VerifiableCredential {
  "@context": string[]
  type: string[]
  issuer: string // DID
  credentialSubject: Record<string, unknown>
  issuanceDate: string
  expirationDate?: string
  credentialStatus?: { type: string; revoked: boolean }
}

export interface CredentialType {
  /** e.g. "SoverityPass" | "UniqueHuman" | "Over18" */
  id: string
  /** Human-readable claim, shown in the share-preview. */
  label: string
  /** What a verifier learns — and nothing more. */
  reveals: string[]
}

export const CREDENTIAL_TYPES: CredentialType[] = [
  {
    id: "SoverityPass",
    label: "Soverity Pass member",
    reveals: ["that you hold a Soverity Pass", "nothing else"],
  },
  {
    id: "UniqueHuman",
    label: "Unique human",
    reveals: ["that a sybil-resistant process marked you a unique human", "nothing else"],
  },
  {
    id: "Over18",
    label: "Over 18",
    reveals: ["that your birthdate is before today minus 18 years", "not your birthdate"],
  },
]

export function buildCredential(
  typeId: string,
  issuer: string,
  subject: Record<string, unknown>,
  ttlDays?: number,
): VerifiableCredential {
  const issuanceDate = new Date().toISOString()
  const expirationDate = ttlDays
    ? new Date(Date.now() + ttlDays * 86_400_000).toISOString()
    : undefined
  return {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    type: ["VerifiableCredential", typeId],
    issuer,
    credentialSubject: subject,
    issuanceDate,
    ...(expirationDate ? { expirationDate } : {}),
  }
}

export function isExpired(vc: VerifiableCredential, now = Date.now()): boolean {
  if (!vc.expirationDate) return false
  return new Date(vc.expirationDate).getTime() <= now
}

export function isRevoked(vc: VerifiableCredential): boolean {
  return vc.credentialStatus?.revoked === true
}
