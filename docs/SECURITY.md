# Security audit checklist

Contract-level:

- [ ] All contracts have NatSpec on external functions.
- [ ] Access control: only-owner modifiers on every state-changing path.
- [ ] Reentrancy: checks-effects-interactions ordering; no external calls before state updates.
- [ ] `SoverityRecovery`: timelock cannot be bypassed; threshold enforced at execute, not propose; cancel clears approvals.
- [ ] `SoverityBadges`: EIP-5192 `locked()` returns true for all tokens; `_update` blocks all transfers.
- [ ] `SoverityPermissions`: revocation is instant and emit events; scope commitments salted per-dApp.
- [ ] Fuzz tests: recovery thresholds, username normalization run in CI.
- [ ] Fork tests against Base mainnet pass.
- [ ] No unbounded loops over user-controlled arrays in external functions.

Protocol-level:

- [ ] Session tokens: HMAC-SHA256, constant-time comparison, short expiry, scope-mask enforced server-side.
- [ ] The `/bridge` iframe serves ONLY avatar/username/ENS — never DID, address, or credentials.
- [ ] No-KYC invariant: no code path stores or transmits legal name, government ID, address, phone, SSN.
- [ ] Client-side encryption keys never leave the device; Lit access-control conditions reviewed.
- [ ] SIWE: domain + nonce + expiry validated on every server verify.
- [ ] Rate limiting on credential issuance (anti-sybil).
- [ ] Relayer: sponsored operations restricted to allowlisted entrypoints and methods.
- [ ] Dependencies: Dependabot enabled; `pnpm audit` clean at release.

Bug bounty (post-launch plan):

- Scope: contracts on Base, SDK, relayer, session endpoint.
- Tiers: critical (key loss / fund loss) → high (auth bypass) → medium (privacy leak) → low (DoS).
- Platform: Immunefi, 10% of critical bounty reserved for sybil-privacy findings.

Run before every release:

```bash
forge test -vv
pnpm test
pnpm lint && pnpm typecheck
pnpm audit
```
