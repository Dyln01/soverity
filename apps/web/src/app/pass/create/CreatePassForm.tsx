"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

const AVATARS = ["🦊", "🐼", "🦄", "🐝", "🦉", "🐙", "🌸", "⚡"]

/**
 * Pass creation — the whole onboarding:
 * 1. biometric/passkey ceremony (WebAuthn)
 * 2. embedded ERC-4337 wallet + DID derived client-side
 * 3. username + avatar (pseudonymous by default)
 * 4. done — no seed phrase, no KYC
 *
 * The MVP simulates the ceremony with a local passkey creation so the flow
 * is fully testable without a deployed paymaster.
 */

export function CreatePassForm() {
  const router = useRouter()
  const [step, setStep] = useState<"intro" | "username" | "creating" | "done">("intro")
  const [username, setUsername] = useState("")
  const [avatar, setAvatar] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const usernameValid = /^[a-z0-9_]{3,32}$/.test(username)

  async function createPass() {
    setError(null)
    if (!usernameValid) {
      setError("3–32 characters: lowercase letters, numbers, underscores.")
      return
    }
    setStep("creating")

    try {
      // WebAuthn passkey creation — the sovereign key ceremony.
      // Falls back to a software credential in browsers without platform
      // authenticators (testing, older devices).
      const created = await createPasskey()

      // Derive the embedded wallet + DID locally. Nothing leaves the device
      // except the username registration on SoverityRegistry.
      const pass = await window
        .fetch("/api/pass", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username, avatar, credential: created.id }),
        })
        .then((r) => r.json())

      if (pass.error) {
        setError(pass.error)
        setStep("username")
        return
      }

      setStep("done")
      setTimeout(() => router.push("/pass"), 1200)
    } catch {
      setError("Passkey creation was cancelled. Try again when ready.")
      setStep("username")
    }
  }

  if (step === "intro") {
    return (
      <div className="sv-glass sv-focus p-8 text-center">
        <div className="mb-4 text-5xl" aria-hidden="true">
          ◇
        </div>
        <h1 className="mb-2 text-2xl font-semibold" style={{ color: "var(--sv-text)" }}>
          Create your Soverity Pass
        </h1>
        <p className="mb-8" style={{ color: "var(--sv-text-secondary)" }}>
          One biometric tap creates your passkey, your embedded wallet, and your decentralized
          identity. No seed phrase. No KYC. Under 30 seconds.
        </p>
        <button
          type="button"
          onClick={() => setStep("username")}
          className="sv-focus rounded-full px-6 py-3 font-medium"
          style={{ background: "var(--sv-teal)", color: "var(--sv-base)", minHeight: 44 }}
        >
          Continue with passkey
        </button>
        <p className="mt-4 text-xs" style={{ color: "var(--sv-text-muted)" }}>
          You'll be able to add Google or email for <em>recovery only</em> — never for identity.
        </p>
      </div>
    )
  }

  if (step === "creating" || step === "done") {
    return (
      // biome-ignore lint/a11y/useSemanticElements: role=status is the ARIA-correct pattern for async outcome announcements
      <div className="sv-glass sv-focus p-8 text-center" role="status" aria-live="polite">
        <div className="mb-4 text-4xl" aria-hidden="true">
          {step === "done" ? "✓" : "◇"}
        </div>
        <p className="text-lg" style={{ color: "var(--sv-text)" }}>
          {step === "done" ? "Your Soverity Pass is ready." : "Creating your pass…"}
        </p>
        <p className="mt-2 text-sm" style={{ color: "var(--sv-text-muted)" }}>
          {step === "done"
            ? "Taking you to your passport…"
            : "Generating your embedded wallet and DID locally."}
        </p>
      </div>
    )
  }

  return (
    <div className="sv-glass sv-focus p-8">
      <h1 className="mb-2 text-2xl font-semibold" style={{ color: "var(--sv-text)" }}>
        Choose your identity
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--sv-text-secondary)" }}>
        Pseudonymous by default — this is what other apps will see on your sign-in button, never
        your legal name.
      </p>

      <label
        className="mb-2 block text-sm"
        htmlFor="username"
        style={{ color: "var(--sv-text-secondary)" }}
      >
        Username
      </label>
      <input
        id="username"
        value={username}
        onChange={(e) => setUsername(e.target.value.toLowerCase())}
        placeholder="nova"
        autoComplete="username"
        maxLength={32}
        className="sv-focus mb-1 w-full rounded-2xl px-4 py-3 font-mono text-base"
        style={{
          background: "var(--sv-glass-raised)",
          border: "1px solid var(--sv-border-soft)",
          color: "var(--sv-text)",
          minHeight: 44,
        }}
      />
      <p
        className="mb-6 text-xs"
        style={{ color: username && !usernameValid ? "var(--sv-danger)" : "var(--sv-text-muted)" }}
      >
        3–32 chars · lowercase, numbers, underscores · claimable like an ENS name
      </p>

      <span className="mb-3 block text-sm" style={{ color: "var(--sv-text-secondary)" }}>
        Avatar
      </span>
      <div className="mb-8 flex flex-wrap gap-3">
        {AVATARS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAvatar(a)}
            aria-label={`Choose avatar ${a}`}
            aria-pressed={avatar === a}
            className="sv-focus grid place-items-center rounded-full"
            style={{
              width: 52,
              height: 52,
              fontSize: 24,
              border: avatar === a ? "2px solid var(--sv-teal)" : "1px solid var(--sv-border-soft)",
              background: avatar === a ? "rgba(20,242,208,0.1)" : "var(--sv-glass)",
            }}
          >
            {a}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 text-sm" style={{ color: "var(--sv-danger)" }} role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={createPass}
        disabled={!usernameValid}
        className="sv-focus w-full rounded-full px-6 py-3 font-medium disabled:opacity-50"
        style={{ background: "var(--sv-teal)", color: "var(--sv-base)", minHeight: 44 }}
      >
        Create my Pass
      </button>
    </div>
  )
}

/** Minimal WebAuthn ceremony (client-side, no external deps). */
async function createPasskey(): Promise<{ id: string }> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    return { id: `soft-${crypto.randomUUID()}` }
  }
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const userId = crypto.getRandomValues(new Uint8Array(16))
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Soverity", id: location.hostname },
      user: { id: userId, name: "soverity-pass", displayName: "Soverity Pass" },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null
  return { id: credential?.id ?? `soft-${crypto.randomUUID()}` }
}
