/** Scopes a dApp may request from a Soverity Pass. */
export type Scope =
  | "openid"
  | "profile"
  | "credentials:read"
  | "credentials:present"
  | "proof:unique_human"
  | "proof:over_18"
  | "address"
  | "email";

export const SCOPE_BIT: Record<Scope, number> = {
  openid: 1 << 0,
  profile: 1 << 1,
  "credentials:read": 1 << 2,
  "credentials:present": 1 << 3,
  "proof:unique_human": 1 << 4,
  "proof:over_18": 1 << 5,
  address: 1 << 6,
  email: 1 << 7,
};

/** Serialize scopes to the on-chain bitmask used by SoverityPermissions. */
export function scopesToBitmask(scopes: Scope[]): number {
  return scopes.reduce((mask, s) => mask | (SCOPE_BIT[s] ?? 0), 0);
}

/** Minimum required on every request; granted implicitly. */
export const REQUIRED_SCOPES: Scope[] = ["openid"];
