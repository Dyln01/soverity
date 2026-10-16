# Soverity SDK — integration guide

## Install

```bash
npm install @soverity/sdk
```

## React

```tsx
import { SoverityButton } from "@soverity/sdk";
import "@soverity/sdk/styles.css";

export function SignIn() {
  return (
    <SoverityButton
      scopes={["openid", "profile"]}
      onSuccess={(result) => {
        // result.session: { did, address?, proofs, scopes, expiresAt }
        // result.siwe:    { message, signature } for server verify
      }}
    />
  );
}
```

## Vanilla JavaScript

```html
<script src="https://cdn.soverity.xyz/sdk.js"></script>
<div data-soverity-button data-soverity='{"scopes":["openid"]}'></div>
```

or programmatically:

```js
Soverity.mount("#signin", { scopes: ["openid"], onSuccess: console.log });
```

## Server verify

```ts
import { verify } from "@soverity/sdk/server";

const session = await verify(req.headers.authorization, {
  secret: process.env.SOVERITY_SESSION_SECRET,
  requiredScopes: ["openid", "profile"],
});
if (!session.valid) return res.status(401).end();
// session.did, session.proofs, session.scopes
```

## Scopes

| Scope | Grants |
|---|---|
| `openid` | sign-in (always required) |
| `profile` | display name + avatar |
| `credentials:read` | list credential types (not contents) |
| `credentials:present` | present a specific credential |
| `proof:unique_human` | ZK proof of unique humanity |
| `proof:over_18` | ZK proof of age > 18 |
| `address` | wallet address reveal |
| `email` | optional recovery email (hashed) |

## The button's four states

1. **No pass detected** — "Sign in with Soverity" → onboarding.
2. **Last-used account** — avatar + "Continue as {name}" → biometric → SIWE → session.
3. **Multiple accounts** — dropdown, last-used first, "Use another Soverity Pass".
4. **Detecting** — skeleton after a 150ms grace period, zero layout shift.

Privacy: before approval the dApp learns only avatar, username, and an
optional ENS name. Nothing else exists to leak.
