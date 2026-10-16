# Soverity Indexer (Ponder)

Reads Soverity contract events from Base and serves them over GraphQL.

```bash
cp .env.example .env       # set BASE_RPC_URL + deployed addresses
pnpm --filter @soverity/indexer dev
```

GraphQL endpoint: `http://localhost:42069/graphql`

Indexed entities:
- `Account` — DID, username, smart account address (from Registry events)
- `Permission` — user/dapp/scope grants and revocations
- `Attestation` — schema + subject + revocation status (UIDs only; credential
  contents never exist on-chain)

Privacy note: the indexer can only ever serve what's on-chain — public
attestation UIDs and permission grants. No personal data, no credentials.
