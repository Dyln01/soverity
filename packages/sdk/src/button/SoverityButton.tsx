import * as React from "react";
import type { DetectedAccount, Scope, SignInResult } from "../types";
import { detectAccounts } from "../detect";
import { loadHint, profilePreviewEnabled } from "../store";

/**
 * SoverityButton — the entire Sign-in-with-Soverity integration.
 *
 *   <SoverityButton scopes={["openid", "profile"]} onSuccess={setSession} />
 *
 * Four render states, fixed dimensions (zero layout shift), 150ms skeleton
 * grace period, three detection layers, full keyboard support, and the
 * glass pill styling from SoverityButton.css.
 */

export interface SoverityButtonProps {
  scopes?: Scope[];
  onSuccess?: (result: SignInResult) => void;
  soverityOrigin?: string;
  className?: string;
}

type Phase = "probing" | "none" | "last-used" | "multi" | "offline";

const SKELETON_GRACE_MS = 150;

export function SoverityButton({
  scopes = ["openid"],
  onSuccess,
  soverityOrigin,
  className = "",
}: SoverityButtonProps) {
  const [phase, setPhase] = React.useState<Phase>("probing");
  const [showSkeleton, setShowSkeleton] = React.useState(false);
  const [accounts, setAccounts] = React.useState<DetectedAccount[]>([]);
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const btnRef = React.useRef<HTMLButtonElement>(null);

  // ---- detection (layers 1→3, priority order) ----
  React.useEffect(() => {
    let cancelled = false;

    const skeletonTimer = setTimeout(() => {
      if (!cancelled) setShowSkeleton(true);
    }, SKELETON_GRACE_MS);

    (async () => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        if (!cancelled) setPhase("offline");
        return;
      }
      if (!profilePreviewEnabled()) {
        if (!cancelled) setPhase("none");
        return;
      }
      // serve the cached hint instantly, then refresh from detection
      const cached = loadHint();
      if (cached && !cancelled) {
        setAccounts([
          {
            id: "cached",
            avatarUrl: cached.avatarUrl,
            username: cached.username,
            ensName: cached.ensName,
            lastUsed: true,
          },
        ]);
        setPhase("last-used");
      }
      const { accounts: found } = await detectAccounts({ soverityOrigin });
      if (cancelled) return;
      clearTimeout(skeletonTimer);
      setShowSkeleton(false);
      if (found.length === 0) {
        if (!cached) setPhase("none");
        return;
      }
      setAccounts(found);
      setPhase(found.length > 1 ? "multi" : "last-used");
    })();

    return () => {
      cancelled = true;
      clearTimeout(skeletonTimer);
    };
  }, [soverityOrigin]);

  // ---- online/offline transitions ----
  React.useEffect(() => {
    const goOnline = () => setPhase((p) => (p === "offline" ? "probing" : p));
    const goOffline = () => setPhase("offline");
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // ---- close dropdown on outside click / Escape ----
  React.useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const signIn = React.useCallback(
    (account?: DetectedAccount) => {
      // The actual biometric → SIWE → session flow is orchestrated by the
      // Soverity provider (extension/in-app browser) or the web app's
      // passkey flow. The SDK exposes the hooks; the MVP ships a
      // window-event-based handshake consumed by apps/web.
      const detail = { scopes, account: account ?? accounts[0] ?? null };
      const acknowledge = (result: SignInResult) => onSuccess?.(result);
      window.dispatchEvent(
        new CustomEvent("soverity:signin", { detail: { ...detail, acknowledge } }),
      );
    },
    [accounts, onSuccess, scopes],
  );

  // ---- render ----

  if (phase === "offline") {
    return (
      <div className={`sv-btn-root ${className}`}>
        <button type="button" className="sv-btn" disabled aria-label="Soverity offline">
          <span className="sv-btn-mark">◇</span>
          <span className="sv-btn-offline">Offline — retrying…</span>
        </button>
      </div>
    );
  }

  if (phase === "probing") {
    if (!showSkeleton) return <div className={`sv-btn-root ${className}`} />;
    return (
      <div className={`sv-btn-root ${className}`}>
        <div className="sv-btn sv-btn-skeleton" aria-label="Checking Soverity" role="status">
          <span className="sv-btn-mark">◇</span>
          <span
            style={{
              display: "inline-flex",
              gap: 6,
              alignItems: "center",
              color: "rgba(242,245,255,0.72)",
            }}
          >
            <span className="sv-skeleton-dot" />
            <span className="sv-skeleton-dot" />
            <span className="sv-skeleton-dot" />
            Checking Soverity
          </span>
        </div>
      </div>
    );
  }

  if (phase === "none") {
    return (
      <div className={`sv-btn-root ${className}`}>
        <button
          type="button"
          className="sv-btn"
          onClick={() => signIn()}
          aria-label="Create a Soverity Pass or sign in"
        >
          <span className="sv-btn-mark" aria-hidden="true">
            ◇
          </span>
          <span>Sign in with Soverity</span>
        </button>
      </div>
    );
  }

  // states: last-used | multi
  const account = accounts[0];
  const label =
    phase === "multi"
      ? `Continue as ${account?.username}. Button. Press Enter to sign in.`
      : `Continue as ${account?.username}. Button. Press Enter to sign in.`;

  return (
    <div className={`sv-btn-root ${className}`} ref={rootRef}>
      <button
        type="button"
        className="sv-btn"
        ref={btnRef}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => (phase === "multi" ? setOpen((o) => !o) : signIn())}
        onKeyDown={(e) => {
          if (phase === "multi" && (e.key === "ArrowDown" || e.key === "Enter")) {
            e.preventDefault();
            setOpen(true);
            // focus first row on next frame
            requestAnimationFrame(() => {
              rootRef.current?.querySelector<HTMLButtonElement>(".sv-dropdown-row")?.focus();
            });
          }
        }}
      >
        <img
          className="sv-btn-avatar"
          src={account?.avatarUrl}
          alt=""
          width={32}
          height={32}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
          }}
        />
        <span className="sv-btn-name">
          Continue as {account?.username}
          <span className="sv-btn-presence" aria-hidden="true" />
        </span>
        {phase === "multi" && (
          <span className={`sv-btn-caret ${open ? "sv-btn-caret-open" : ""}`} aria-hidden="true" />
        )}
      </button>

      {phase === "multi" && open && (
        <div className="sv-dropdown" role="listbox" aria-label="Choose a Soverity Pass">
          {accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              role="option"
              aria-selected={a.lastUsed}
              className="sv-dropdown-row"
              onClick={() => {
                setOpen(false);
                signIn(a);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setOpen(false);
                  btnRef.current?.focus();
                }
              }}
            >
              <img className="sv-btn-avatar" src={a.avatarUrl} alt="" width={32} height={32} />
              <span>{a.username}</span>
              {a.lastUsed && (
                <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.6 }}>last used</span>
              )}
            </button>
          ))}
          <div className="sv-dropdown-divider" />
          <button
            type="button"
            className="sv-dropdown-row"
            onClick={() => {
              setOpen(false);
              signIn();
            }}
          >
            Use another Soverity Pass
          </button>
        </div>
      )}
    </div>
  );
}
