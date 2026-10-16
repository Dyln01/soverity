# Soverity Relayer

Gasless meta-transactions for Soverity Pass holders. The paymaster
sponsors gas; users never see a fee.

```bash
cp .env.example .env
pnpm --filter @soverity/relayer dev   # listens on :3400
```

| Env | Purpose |
|---|---|
| `RELAYER_ALLOWED_TARGETS` | comma-separated allowlisted contract addresses |
| `RELAYER_RATE_LIMIT` | sponsored txs per DID per hour (default 20) |
| `PORT` | listen port (default 3400) |

The relayer never holds user keys — users sign intents with their
passkey-unlocked wallet; the relayer only wraps and sponsors.
