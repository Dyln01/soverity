import Link from "next/link"

const steps = [
  {
    n: "1",
    title: "Install",
    code: "npm install @soverity/sdk",
    body: "One package. React optional. Tree-shakeable ESM/CJS/UMD.",
  },
  {
    n: "2",
    title: "Drop the button in",
    code: '<SoverityButton scopes={["openid"]} onSuccess={setSession} />',
    body: "Detection, profile preview, biometrics, SIWE, session — all automatic.",
  },
  {
    n: "3",
    title: "Handle success",
    code: "const { did, proofs, expiresAt } = session",
    body: "You get a DID, optional address, granted proofs, and an expiry. Nothing else exists to leak.",
  },
  {
    n: "4",
    title: "Verify server-side",
    code: "const session = await verify(req.headers.authorization, { secret })",
    body: "One function call from @soverity/sdk/server. Bearer token, HMAC-checked, scope-verified.",
  },
  {
    n: "5",
    title: "Done",
    code: "// no keys, no redirects, no webhooks",
    body: "That's the whole integration. Your users never see a seed phrase or a gas fee.",
  },
]

export const metadata = {
  title: "Developers — one line to ship",
}

export default function DevelopersPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-12">
        <h1 className="mb-3 text-4xl font-semibold" style={{ color: "var(--sv-text)" }}>
          One line to sign in.
          <br />
          One line to verify.
        </h1>
        <p className="text-lg" style={{ color: "var(--sv-text-secondary)" }}>
          If integration is painful, nothing else matters. So it isn't.
        </p>
      </header>

      <ol className="grid gap-5">
        {steps.map((s) => (
          <li key={s.n} className="sv-glass sv-focus sv-lift flex gap-5 p-6">
            <span
              className="grid h-10 w-10 flex-none place-items-center rounded-full font-mono text-lg font-bold"
              style={{
                color: "var(--sv-teal)",
                border: "1px solid rgba(20,242,208,0.3)",
                background: "rgba(20,242,208,0.06)",
              }}
            >
              {s.n}
            </span>
            <div className="min-w-0">
              <h2 className="mb-1 font-semibold" style={{ color: "var(--sv-text)" }}>
                {s.title}
              </h2>
              <pre
                className="mb-2 overflow-x-auto rounded-xl px-4 py-3 font-mono text-sm"
                style={{
                  background: "rgba(10,12,22,0.5)",
                  border: "1px solid var(--sv-border-soft)",
                  color: "var(--sv-teal)",
                }}
              >
                <code>{s.code}</code>
              </pre>
              <p className="text-sm" style={{ color: "var(--sv-text-secondary)" }}>
                {s.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <section className="sv-glass sv-focus mt-10 p-6">
        <h2 className="mb-2 font-semibold" style={{ color: "var(--sv-text)" }}>
          Vanilla JavaScript
        </h2>
        <pre
          className="overflow-x-auto rounded-xl px-4 py-3 font-mono text-sm"
          style={{
            background: "rgba(10,12,22,0.5)",
            border: "1px solid var(--sv-border-soft)",
            color: "var(--sv-teal)",
          }}
        >
          <code>{`<script src="https://cdn.soverity.xyz/sdk.js"></script>
<div data-soverity-button data-soverity='{"scopes":["openid"]}'></div>`}</code>
        </pre>
      </section>

      <p className="mt-10 text-center text-sm" style={{ color: "var(--sv-text-muted)" }}>
        Want to see it live?{" "}
        <a href="https://demo.soverity.xyz" style={{ color: "var(--sv-teal)" }}>
          Try the demo dApp →
        </a>{" "}
        or{" "}
        <Link href="/" style={{ color: "var(--sv-teal)" }}>
          back home
        </Link>
      </p>
    </div>
  )
}
