"use client";

import { useEffect, useState } from "react";
import { SoverityButton } from "@soverity/sdk";
import type { SignInResult } from "@soverity/sdk";
import { GlassCard } from "@soverity/ui";

/**
 * /pass — the Soverity passport dashboard: profile, credentials, and the
 * permissions panel. Sign-in via the same SoverityButton the SDK ships.
 */
export function PassClient() {
  const [result, setResult] = useState<SignInResult | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const session = result?.session;

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <header className="mb-10 flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: "var(--sv-text)" }}>
          Your Soverity Pass
        </h1>
        {mounted && <SoverityButton scopes={["openid", "profile"]} onSuccess={setResult} />}
      </header>

      {!session ? (
        <GlassCard className="p-8 text-center" glow="teal">
          <p className="text-lg" style={{ color: "var(--sv-text)" }}>
            Sign in to view your passport
          </p>
          <p className="mt-2 text-sm" style={{ color: "var(--sv-text-muted)" }}>
            One click plus one biometric tap. Nothing is shared until you approve.
          </p>
        </GlassCard>
      ) : (
        <div className="grid gap-6">
          <GlassCard className="p-6" elevation="raised">
            <h2 className="mb-1 font-semibold" style={{ color: "var(--sv-text)" }}>
              Profile
            </h2>
            <p className="font-mono text-sm break-all" style={{ color: "var(--sv-teal)" }}>
              {session.did}
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--sv-text-secondary)" }}>
              Scopes granted here: {session.scopes.join(", ")}
            </p>
          </GlassCard>

          <GlassCard className="p-6">
            <h2 className="mb-3 font-semibold" style={{ color: "var(--sv-text)" }}>
              Credentials
            </h2>
            <p className="text-sm" style={{ color: "var(--sv-text-muted)" }}>
              Encrypted, client-side. Import verifiable credentials, scan a QR
              code, or mint from partners — coming with phase 2 proofs.
            </p>
          </GlassCard>

          <GlassCard className="p-6">
            <h2 className="mb-3 font-semibold" style={{ color: "var(--sv-text)" }}>
              Permissions
            </h2>
            <p className="text-sm" style={{ color: "var(--sv-text-muted)" }}>
              Every app you connect appears here. Revoke anything, anytime —
              on-chain, instantly.
            </p>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
