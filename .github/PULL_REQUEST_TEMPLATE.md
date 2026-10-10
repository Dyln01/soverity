## Summary

<!-- What changed and why. One or two sentences. -->

## Type of change

- [ ] feat — new feature
- [ ] fix — bug fix
- [ ] chore / docs / ci / refactor / test

## Checklist

- [ ] Conventional Commit message (`feat(scope): ...`)
- [ ] `pnpm lint` and `pnpm typecheck` pass locally
- [ ] SDK/UI tests pass (`pnpm test`)
- [ ] Contract tests pass (`forge test` in `packages/contracts`)
- [ ] No KYC data anywhere: no legal-name, government-ID, address, phone, or SSN fields
- [ ] Privacy: nothing identifying leaves the client before user approval
- [ ] Glass UI: WCAG AA contrast, 44px touch targets, reduced-motion + reduced-transparency respected
