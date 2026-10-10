# Vercel deployment — soverity.xyz

The web app (`apps/web`) deploys on every push to `main` via GitHub Actions
(`deploy.yml`) using a prebuilt Vercel deployment. Required repository
secrets:

| Secret | Purpose |
|---|---|
| `VERCEL_TOKEN` | Vercel API token for pull/build/deploy |
| `BASE_RPC_URL` | Base RPC endpoint for `forge script` |
| `DEPLOYER_KEY` | Contract deployer private key |
| `NPM_TOKEN` | npm publish token (only used when a commit message contains `release`) |

Environment variables for the Next.js app (set in the Vercel dashboard):

- `SOVERITY_SESSION_SECRET` — HMAC secret for session token minting.

Setup:

1. `pnpm dlx vercel link` inside `apps/web` (once) to link the project.
2. Set the secrets above in GitHub → Settings → Secrets and variables → Actions.
3. Add `soverity.xyz` as the production domain in the Vercel dashboard.

Pull requests automatically receive preview deployments from Vercel's
GitHub integration, with the preview URL commented on the PR.
