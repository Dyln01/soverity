# Soverity Contracts

Foundry package for the Soverity decentralized identity protocol on Base:
DID registry, EAS-style credentials, soulbound badges, guardian-based
social recovery, and scoped dApp permissions.

## Contracts (`src/`)

| Contract | Purpose |
| --- | --- |
| `SoverityRegistry.sol` | DID → smart-account + unique username registry, multi-pass per owner, admin recovery hook |
| `SoverityCredentials.sol` | EAS-style schema registry, attestations, revocation, ZK-friendly salted commitments |
| `SoverityBadges.sol` | Soulbound ERC-721 badges (EIP-5192), tiers Bronze/Silver/Gold, issuer-role minting |
| `SoverityRecovery.sol` | Guardian social recovery: threshold approvals + timelock; reassigns pass ownership via the registry |
| `SoverityPermissions.sol` | Self-service dApp grants with scope bitmasks or hashed scope commitments |

## Commands

```bash
pnpm build   # forge build
pnpm test    # forge test
pnpm fmt     # forge fmt
pnpm lint    # forge fmt --check
```

Dependencies (forge-std, OpenZeppelin v5) are git submodules under `lib/`.
After cloning, run `git submodule update --init --recursive` from the repo
root.

## Deploy script

`script/Deploy.s.sol` deploys all five contracts with `vm.startBroadcast()`.
Forge records every deployed address in `broadcast/Deploy.s.sol/<chain>/run-*.json`
automatically.

See `infra/foundry/README.md` for Base testnet deployment instructions.

## Notes

- `SoverityBadges` never unlocks tokens: `_update` blocks all transfers
  (EIP-5192 `Locked` is emitted at mint and `locked()` returns true).
- `SoverityRecovery` starts with the deployer as sole guardian and
  threshold 1 so the deployment is immediately usable; rotate the guardian
  set with `addGuardian`/`removeGuardian` before production.
- The registry's `setPassOwner` is admin-only and intended to be called by
  the recovery module: transfer registry `Ownable` to the recovery contract
  (as the test suite does) to make executed recoveries take effect on-chain.
