"use client";

import { useState } from "react";
import { SoverityButton } from "@soverity/sdk";
import type { SignInResult } from "@soverity/sdk";
import { GlassCard } from "@soverity/ui";

/**
 * Demo dApp — a generic Web3 app that knows NOTHING about Soverity's
 * internals. Its entire integration is:
 *
 *   <SoverityButton scopes={["openid", "profile"]} onSuccess={setResult} />
 *
 * plus a server verify call behind /api/me.
 */
export default function Home() {
  const [result, setResult] = useState<SignInResult | null>(null);
  const [serverCheck, setServerCheck] = useState<string | null>(null);
  const session = result?.session;

  async function verifyOnServer() {
    if (!result) return;
    const res = await fetch("/api/me", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(result),
    }).then((r) => r.json());
    setServerCheck(res.valid ? `Verified: ${res.did}` : `Rejected: ${res.reason}`);
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-20">
      <p
        className="mb-4 inline-block rounded-full px-3 py-1 text-xs uppercase tracking-widest"
        style={{ color: "var(--sv-warning)", border: "1px solid rgba(245,198,107,0.3)" }}
      >
        Demo dApp · not affiliated with Soverity
      </p>
      <h1 className="mb-3 text-3xl font-semibold" style={{ color: "var(--sv-text)" }}>
        A dApp with zero identity code
      </h1>
      <p className="mb-8" style={{ color: "var(--sv-text-secondary)" }}>
        This app has no wallet-connect modal, no seed-phrase screen, no KYC
        form. Its entire auth is the button below — one component, one
        callback, one server function.
      </p>

      <GlassCard className="mb-6 p-6" elevation="raised" glow="teal">
        <h2 className="mb-4 font-semibold" style={{ color: "var(--sv-text)" }}>
          Sign in
        </h2>
        <SoverityButton
          scopes={["openid", "profile", "proof:unique_human"]}
          onSuccess={setResult}
        />
        <p className="mt-4 text-xs" style={{ color: "var(--sv-text-muted)" }}>
          Requests: openid, profile, proof:unique_human — you approve the rest
          in the Soverity permission modal.
        </p>
      </GlassCard>

      {session && (
        <GlassCard className="mb-6 p-6">
          <h2 className="mb-3 font-semibold" style={{ color: "var(--sv-text)" }}>
            Session received
          </h2>
          <dl className="grid gap-2 text-sm" style={{ color: "var(--sv-text-secondary)" }}>
            <div className="flex gap-2">
              <dt className="font-mono flex-none">did:</dt>
              <dd className="font-mono break-all" style={{ color: "var(--sv-teal)" }}>
                {session.did}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-mono flex-none">scopes:</dt>
              <dd className="font-mono">{session.scopes.join(", ") || "none"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-mono flex-none">proofs:</dt>
              <dd className="font-mono">{session.proofs.join(", ") || "none shared"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-mono flex-none">expires:</dt>
              <dd className="font-mono">{new Date(session.expiresAt).toISOString()}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={verifyOnServer}
            className="sv-focus mt-5 rounded-full px-5 py-2.5 text-sm font-medium"
            style={{ background: "var(--sv-teal)", color: "var(--sv-base)", minHeight: 44 }}
          >
            Verify server-side (one function call)
          </button>
          {serverCheck && (
            <p className="mt-3 font-mono text-sm" style={{ color: "var(--sv-success)" }}>
              {serverCheck}
            </p>
          )}
        </GlassCard>
      )}

      <p className="text-center text-sm" style={{ color: "var(--sv-text-muted)" }}>
        Full source: <span className="font-mono">apps/demo-dapp</span> — the
        integration is under 30 lines.
      </p>
    </div>
  );
}
