<div align="center">

# ◇ Soverity

**Sovereign identity. Google-simple.**

A user-owned decentralized passport that works like a Google account —
but no central authority owns the identity, and **no KYC is ever requested**.

One line to sign in. One line to add a passport. One line to verify.

</div>

---

## Why

Like Google: one-click sign-in, a unified profile, connected apps and
permissions, easy recovery.

Unlike Google: **you** hold the keys. Identity is anchored to DIDs,
verifiable credentials, and on-chain attestations on Base. Data is
encrypted client-side. No server can lock you out — and we never ask for
a government ID, legal name, address, phone, or SSN. Ever.

## The one-line integration

```tsx
import { SoverityButton } from "@soverity/sdk";

<SoverityButton scopes={["openid", "profile"]} onSuccess={setSession} />
```

Vanilla:

```html
<script src="https://cdn.soverity.xyz/sdk.js"></script>
<div data-soverity-button data-soverity='{"scopes":["openid"]}'></div>
```

Server:

```ts
import { verify } from "@soverity/sdk/server";

const session = await verify(req.headers.authorization, { secret });
```

That's the whole thing. No keys, no redirects, no webhooks.

## Repo layout

```
apps/
  web          → soverity.xyz (Next.js 14)
  demo-dapp    → sample dApp with the full integration
  docs         → developer documentation
packages/
  sdk          → the published Soverity SDK
  contracts    → Solidity + Foundry (Registry, Credentials, Badges, Recovery, Permissions)
  ui           → the glass design system
  identity     → DID / VC / ZK helpers
  storage      → Ceramic / IPFS / Lit wrappers
  config       → shared tsconfig + Biome
services/
  indexer      → Ponder indexer (contract events)
  relayer      → gasless meta-transaction relayer
infra/
  vercel       → deployment config
  foundry      → deploy scripts + Base instructions
```

## Development

```bash
pnpm install
pnpm build          # all packages
pnpm test           # SDK + UI tests (Vitest)
pnpm lint           # Biome
pnpm typecheck

# contracts
cd packages/contracts
forge build
forge test
```

Requires Node ≥ 20 and pnpm ≥ 9. Foundry installs via
`curl -L https://foundry.paradigm.xyz | bash && foundryup`.

## Contracts

| Contract | Purpose |
|---|---|
| `SoverityRegistry` | DID → smart account + ENS-like usernames |
| `SoverityCredentials` | EAS-style schemas, issue/revoke/verify attestations |
| `SoverityBadges` | soulbound reputation badges (EIP-5192) |
| `SoverityRecovery` | guardian social recovery with timelock + thresholds |
| `SoverityPermissions` | per-dApp scope grants, revocable on-chain |

Deployed via `forge script` to Base (see `infra/foundry`).

## Privacy rules (non-negotiable)

- Never ask for government ID, legal name, address, phone, or SSN.
- Optional email only for recovery — hashed and encrypted.
- Client-side encryption (Lit Protocol). ZK proofs for selective disclosure.
- The sign-in hint exposes ONLY avatar, username, optional ENS — nothing
  identifying until the user approves.
- Users can export or delete their entire passport at any time.

## CI/CD

- Every push/PR to `main`/`dev`: Biome lint, typecheck, SDK tests, contract tests.
- Every push to `main`: web deploys to Vercel (soverity.xyz), contracts deploy to Base.
- Every PR: Vercel preview + preview URL comment.
- Commit message containing `release`: SDK publishes to npm.
- Conventional Commits enforced by commitlint + husky. Squash-merge only.

## License

MIT — see LICENSE.
