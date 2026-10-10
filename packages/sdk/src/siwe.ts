/**
 * SIWE (Sign-In with Ethereum, EIP-4361) message creation and session
 * derivation. The SDK signs with the passkey-unlocked embedded wallet and
 * hands the {message, signature} pair to the dApp, which verifies it
 * server-side with the one-line `verify` helper.
 */

export interface SiweMessageInput {
  domain: string;
  address: string;
  statement?: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
  scopes?: string[];
}

/** Build the plain-text EIP-4361 message for signing. */
export function buildSiweMessage(input: SiweMessageInput): string {
  const lines = [
    `${input.domain} wants you to sign in with your Ethereum account:`,
    input.address,
    "",
    input.statement ??
      "Sign in with Soverity — sovereign identity, Google-simple. No KYC, ever.",
    "",
    `URI: ${input.uri}`,
    `Version: ${input.version}`,
    `Chain ID: ${input.chainId}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
  ];
  if (input.expirationTime) {
    lines.push(`Expiration Time: ${input.expirationTime}`);
  }
  if (input.scopes?.length) {
    lines.push(`Scopes: ${input.scopes.join(" ")}`);
  }
  return lines.join("\n");
}

export function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** RFC 3339 timestamp. */
export function nowIso(): string {
  return new Date().toISOString();
}

export function expiresIso(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}
