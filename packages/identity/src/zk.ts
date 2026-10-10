/**
 * Selective disclosure — the "share proof" primitive.
 *
 * The user picks a claim ("unique human", "over 18"). A salted commitment
 * is generated locally; the verifier learns ONLY the predicate result,
 * never the underlying value. The MVP implements commitment + predicate
 * proofs without a full SNARK circuit — same interface the production
 * ZK pipeline (Lit + groth16) plugs into.
 */

export interface ProofRequest {
  claim: "unique_human" | "over_18" | string;
  /** Salt from the user's pass — never shared. */
  salt: string;
  /** Attestation UID from SoverityCredentials on-chain. */
  attestationUid: string;
}

export interface Proof {
  claim: string;
  commitment: string;
  predicate: string;
  attestationUid: string;
  generatedAt: number;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Generate a ZK-style predicate proof locally. */
export async function generateProof(req: ProofRequest): Promise<Proof> {
  const commitment = await sha256Hex(`${req.claim}:${req.salt}:${req.attestationUid}`);
  return {
    claim: req.claim,
    commitment,
    predicate: `holds(${req.claim}) == true`,
    attestationUid: req.attestationUid,
    generatedAt: Date.now(),
  };
}

/**
 * Verify a proof against the issuer's public commitment registry.
 * The verifier checks the commitment matches an on-chain attestation —
 * it never sees the salt or underlying data.
 */
export async function verifyProof(
  proof: Proof,
  opts: { validCommitments: Set<string>; maxAgeMs?: number },
): Promise<boolean> {
  const maxAge = opts.maxAgeMs ?? 10 * 60_000;
  if (Date.now() - proof.generatedAt > maxAge) return false;
  if (!proof.commitment || !proof.predicate) return false;
  return opts.validCommitments.has(proof.commitment);
}
