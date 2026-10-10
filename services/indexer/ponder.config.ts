import type { Config } from "ponder"

/**
 * Ponder indexer — reads Soverity contract events from Base and serves
 * them via GraphQL. The web app uses it for the permissions dashboard and
 * credential lookups (read path only; writes always go through the user's
 * wallet or the relayer).
 */

export const config: Config = {
  networks: [
    {
      name: "base",
      chainId: 8453,
      transport: {
        type: "http",
        options: { url: process.env.BASE_RPC_URL ?? "https://mainnet.base.org" },
      },
    },
  ],
  contracts: {
    SoverityRegistry: {
      abi: "../packages/contracts/out/SoverityRegistry.sol/SoverityRegistry.json",
      address: process.env.REGISTRY_ADDRESS,
      startBlock: 0,
      network: "base",
    },
    SoverityCredentials: {
      abi: "../packages/contracts/out/SoverityCredentials.sol/SoverityCredentials.json",
      address: process.env.CREDENTIALS_ADDRESS,
      startBlock: 0,
      network: "base",
    },
    SoverityPermissions: {
      abi: "../packages/contracts/out/SoverityPermissions.sol/SoverityPermissions.json",
      address: process.env.PERMISSIONS_ADDRESS,
      startBlock: 0,
      network: "base",
    },
  },
}
