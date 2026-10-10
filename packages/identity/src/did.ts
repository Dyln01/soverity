/**
 * DID helpers — create and parse W3C DIDs for the Soverity Pass.
 *
 * MVP supports the `pkh` method (did:pkh:eip155:<chain>:<address>) since
 * every Soverity Pass owns an ERC-4337 smart account on Base. The `ethr`
 * and `key` methods share the same parsing surface.
 */

export type ChainId = number

/** Build a did:pkh for an EVM account. */
export function didPkh(chainId: ChainId, address: string): string {
  const clean = address.toLowerCase()
  if (!/^0x[0-9a-f]{40}$/.test(clean)) {
    throw new Error(`invalid EVM address: ${address}`)
  }
  return `did:pkh:eip155:${chainId}:${clean}`
}

/** Base mainnet. */
export const BASE_CHAIN_ID = 8453 as ChainId

export interface ParsedDid {
  method: string
  chainId?: ChainId
  address?: string
  raw: string
}

const DID_RE = /^did:([a-z]+):([^\s]+)$/

export function parseDid(did: string): ParsedDid | null {
  const m = DID_RE.exec(did)
  if (!m) return null
  const method = m[1] ?? ""
  let chainId: ChainId | undefined
  let address: string | undefined
  if (method === "pkh") {
    // eip155:<chain>:<address>
    const parts = (m[2] ?? "").split(":")
    if (parts[0] === "eip155" && parts.length === 3) {
      chainId = Number(parts[1])
      address = parts[2]
    }
  }
  return { method, chainId, address, raw: did }
}

/** Short form for UIs: did:pkh:eip155:8453:0xabc…1234 → 0xabc…1234 */
export function shortDid(did: string): string {
  const parsed = parseDid(did)
  const addr = parsed?.address
  if (!addr) return did
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}
