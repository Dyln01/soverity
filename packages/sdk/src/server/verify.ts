import type { Scope } from "../types/scopes";
import { scopesToBitmask } from "../types/scopes";

/**
 * Server-side session verification — the entire server integration.
 *
 *   import { verify } from "@soverity/sdk/server";
 *   const session = await verify(req.headers.authorization);
 *
 * Checks: Bearer scheme, token integrity (HMAC over the session payload),
 * expiry, and that every requested scope bit is present in the granted
 * mask. Returns { valid: false } on ANY failure — never throws.
 */

export interface SoveritySessionToken {
  /** W3C DID. */
  did: string;
  address?: string;
  proofs: string[];
  scopes: Scope[];
  grantedMask: number;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
  h: string;
}

export interface VerifyResult {
  valid: boolean;
  did?: string;
  address?: string;
  proofs?: string[];
  scopes?: Scope[];
  reason?: "malformed" | "expired" | "bad-signature" | "missing-scope";
}

/** Stripped-down base64url (no dependencies). */
function b64uEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64uDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function signPayload(secret: string, payloadB64u: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64u));
  return b64uEncode(new Uint8Array(sig));
}

/** Mint a session token (used by the Soverity session endpoint after SIWE verify). */
export async function issueToken(
  session: Omit<SoveritySessionToken, "h">,
  secret: string,
): Promise<string> {
  const payload = b64uEncode(new TextEncoder().encode(JSON.stringify(session)));
  const h = await signPayload(secret, payload);
  return `${payload}.${h}`;
}

export function parseToken(token: string): SoveritySessionToken | null {
  const [payload, h] = token.split(".");
  if (!payload || !h) return null;
  try {
    const json = new TextDecoder().decode(b64uDecode(payload));
    const parsed = JSON.parse(json) as SoveritySessionToken;
    if (!parsed.did || typeof parsed.expiresAt !== "number") return null;
    return { ...parsed, h };
  } catch {
    return null;
  }
}

/**
 * Verify an Authorization header value. `secret` is the server's HMAC
 * session secret. `requiredScopes` are checked against the granted mask.
 */
export async function verify(
  authorizationHeader: string | undefined | null,
  options: { secret: string; requiredScopes?: Scope[]; now?: number },
): Promise<VerifyResult> {
  const { secret, requiredScopes = [], now = Date.now() } = options;

  if (!authorizationHeader?.startsWith("Bearer ")) {
    return { valid: false, reason: "malformed" };
  }
  const token = authorizationHeader.slice("Bearer ".length).trim();
  const parsed = parseToken(token);
  if (!parsed) return { valid: false, reason: "malformed" };

  const [payload] = token.split(".");
  const expected = await signPayload(secret, payload ?? "");
  // constant-time-ish compare
  if (!parsed.h || expected.length !== parsed.h.length || expected !== parsed.h) {
    return { valid: false, reason: "bad-signature" };
  }

  if (parsed.expiresAt <= now) {
    return { valid: false, reason: "expired" };
  }

  const required = scopesToBitmask(requiredScopes);
  if ((parsed.grantedMask & required) !== required) {
    return { valid: false, reason: "missing-scope" };
  }

  return {
    valid: true,
    did: parsed.did,
    address: parsed.address,
    proofs: parsed.proofs,
    scopes: parsed.scopes,
  };
}

/** Express adapter — one line in an auth middleware. */
export function expressAuth(secret: string, requiredScopes: Scope[] = []) {
  return async (req: { headers: Record<string, string | undefined> }, res: any, next: any) => {
    const result = await verify(req.headers.authorization, { secret, requiredScopes });
    (req as any).soverity = result;
    if (!result.valid) {
      res?.status?.(401)?.json?.({ error: "unauthorized", reason: result.reason });
      return;
    }
    next?.();
  };
}
