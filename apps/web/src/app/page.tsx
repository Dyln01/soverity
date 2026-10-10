import Link from "next/link";

const features = [
  {
    title: "One-line sign-in",
    body: "Your users click once, tap biometrics, done. No seed phrases, no network switching, no gas.",
  },
  {
    title: "Non-custodial by default",
    body: "Keys live in a passkey-secured embedded wallet. We can never lock you out — or anyone in.",
  },
  {
    title: "No KYC. Ever.",
    body: "No government ID, no legal name, no address. Prove what's needed with zero-knowledge proofs — nothing more.",
  },
  {
    title: "Portable identity",
    body: "DIDs, verifiable credentials and on-chain attestations follow you across every app, everywhere.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
      <header className="mb-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            style={{ color: "var(--sv-teal)", fontSize: 24, lineHeight: 1 }}
          >
            ◇
          </span>
          <span className="text-lg font-semibold" style={{ color: "var(--sv-text)" }}>
            Soverity
          </span>
        </div>
        <nav className="flex items-center gap-6 text-sm" style={{ color: "var(--sv-text-secondary)" }}>
          <a href="#how" className="hover:underline">
            How it works
          </a>
          <a href="/developers" className="hover:underline">
            Developers
          </a>
          <Link href="/pass" className="hover:underline" style={{ color: "var(--sv-teal)" }}>
            My Pass
          </Link>
        </nav>
      </header>

      <section className="mb-20 text-center md:mb-28">
        <p
          className="mb-4 inline-block rounded-full px-4 py-1 text-xs uppercase tracking-widest"
          style={{
            color: "var(--sv-teal)",
            border: "1px solid rgba(20,242,208,0.3)",
            background: "rgba(20,242,208,0.06)",
          }}
        >
          Decentralized passport · No KYC
        </p>
        <h1
          className="mb-6 font-semibold leading-tight"
          style={{ color: "var(--sv-text)", fontSize: "clamp(40px, 7vw, 64px)" }}
        >
          Sovereign identity.
          <br />
          Google-simple.
        </h1>
        <p
          className="mx-auto mb-10 max-w-xl text-lg"
          style={{ color: "var(--sv-text-secondary)" }}
        >
          One click to sign in. One line to add a passport. One line to verify.
          Your identity, your keys — on Base.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/pass"
            className="sv-focus sv-lift rounded-full px-6 py-3 text-base font-medium"
            style={{
              color: "var(--sv-base)",
              background: "var(--sv-teal)",
              minHeight: 44,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Create Soverity Pass
          </Link>
          <a
            href="/developers"
            className="sv-focus sv-lift rounded-full px-6 py-3 text-base font-medium"
            style={{
              color: "var(--sv-text)",
              border: "1px solid var(--sv-border-strong)",
              background: "var(--sv-glass)",
              minHeight: 44,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Integrate in one line
          </a>
        </div>
        <p className="mt-6 text-sm" style={{ color: "var(--sv-text-muted)" }}>
          Ready in under 30 seconds. No seed phrase, ever.
        </p>
      </section>

      <section id="how" className="mb-20">
        <h2 className="sr-only">Why Soverity</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="sv-glass sv-focus sv-lift p-6">
              <h3 className="mb-2 text-lg font-semibold" style={{ color: "var(--sv-text)" }}>
                {f.title}
              </h3>
              <p style={{ color: "var(--sv-text-secondary)" }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer
        className="border-t pt-8 text-center text-sm"
        style={{ borderColor: "var(--sv-border-soft)", color: "var(--sv-text-muted)" }}
      >
        <p>
          Soverity — user-owned identity. This site never asks for your legal
          name, government ID, or address.
        </p>
        <p className="mt-2">
          <a href="/developers" style={{ color: "var(--sv-teal)" }}>
            Read the one-line integration guide →
          </a>
        </p>
      </footer>
    </div>
  );
}
