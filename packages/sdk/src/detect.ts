import type { DetectedAccount, SoverityHint } from "./types";

/**
 * Account detection — four layers in priority order:
 *   1. injected provider (extension / in-app browser), local encrypted vault
 *   2. cross-site session hint via iframe to soverity.xyz + postMessage
 *   3. WebAuthn passkey lookup for this origin
 *   4. nothing detected → state "none"
 *
 * The probing never exposes more than avatarUrl/username/ensName; the DID,
 * address, credentials and email are NOT part of a hint and cannot leak.
 */

export interface DetectOptions {
  /** Origin of the Soverity web app that serves the postMessage bridge. */
  soverityOrigin?: string;
  /** Abort probing after this many ms (the 150ms skeleton grace period). */
  timeoutMs?: number;
}

const DEFAULT_ORIGIN = "https://soverity.xyz";

/** Layer 1: injected provider vault, no network call. */
async function detectInjected(): Promise<DetectedAccount[]> {
  const provider = (globalThis as Record<string, unknown>).soverity;
  if (!provider || typeof (provider as { listAccounts?: unknown }).listAccounts !== "function") {
    return [];
  }
  try {
    const accounts = await (provider as { listAccounts: () => Promise<DetectedAccount[]> })
      .listAccounts();
    return accounts.filter((a) => a.username && a.avatarUrl);
  } catch {
    return [];
  }
}

/** Layer 2: cross-site hint via iframe postMessage bridge on soverity.xyz. */
async function detectIframeHint(origin: string, timeoutMs: number): Promise<DetectedAccount[]> {
  if (typeof window === "undefined") return [];
  return new Promise((resolve) => {
    let iframe: HTMLIFrameElement | null = null;
    const timer = setTimeout(() => {
      cleanup();
      resolve([]);
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      iframe?.remove();
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== origin) return;
      const data = event.data as { type?: string; hint?: SoverityHint[] | SoverityHint };
      if (data?.type !== "soverity:hint" || !data.hint) return;
      cleanup();
      const hints = Array.isArray(data.hint) ? data.hint : [data.hint];
      resolve(
        hints
          .filter((h) => h.username && h.avatarUrl)
          .map((h, i) => ({
            id: `hint-${h.username}-${i}`,
            avatarUrl: h.avatarUrl,
            username: h.username,
            ensName: h.ensName,
            lastUsed: i === 0,
          })),
      );
    }

    window.addEventListener("message", onMessage);
    iframe = document.createElement("iframe");
    iframe.src = `${origin}/bridge`;
    iframe.style.display = "none";
    iframe.setAttribute("aria-hidden", "true");
    iframe.tabIndex = -1;
    document.body.appendChild(iframe);
  });
}

/** Layer 3: passkey presence for this origin (never creates credentials). */
async function detectPasskey(): Promise<boolean> {
  const PublicKeyCredential = (globalThis as Record<string, unknown>).PublicKeyCredential as
    | { isUserMediationAvailable?: () => Promise<boolean> }
    | undefined;
  if (!PublicKeyCredential?.isUserMediationAvailable) return false;
  try {
    return await PublicKeyCredential.isUserMediationAvailable();
  } catch {
    return false;
  }
}

/**
 * Run all detection layers in priority order. The first layer that finds
 * accounts wins; lower layers only run when the ones above came up empty.
 */
export async function detectAccounts(options: DetectOptions = {}): Promise<{
  accounts: DetectedAccount[];
  hasPasskey: boolean;
}> {
  const origin = options.soverityOrigin ?? DEFAULT_ORIGIN;
  const timeoutMs = options.timeoutMs ?? 3000;

  const injected = await detectInjected();
  if (injected.length > 0) {
    return { accounts: injected, hasPasskey: false };
  }

  const hinted = await detectIframeHint(origin, timeoutMs);
  if (hinted.length > 0) {
    return { accounts: hinted, hasPasskey: false };
  }

  const hasPasskey = await detectPasskey();
  return { accounts: [], hasPasskey };
}

/** Normalize raw hint rows into DetectedAccount shape. */
export function toAccounts(hints: SoverityHint[]): DetectedAccount[] {
  return hints
    .filter((h) => h.username && h.avatarUrl)
    .map((h, i) => ({
      id: `hint-${h.username}-${i}`,
      avatarUrl: h.avatarUrl,
      username: h.username,
      ensName: h.ensName,
      lastUsed: i === 0,
    }));
}
