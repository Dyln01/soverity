import type { SoverityHint } from "./types"

/**
 * Local account cache.
 *
 * The cache stores ONLY the three display fields of a hint. It lives in
 * localStorage (base or floating surface equivalent), is cleared on sign
 * out, and is read by the button so repeat visits render instantly with
 * zero layout shift. No cookies, no cross-site sharing, no fingerprint.
 */

const KEY = "soverity:hint"

function safeStorage(): Storage | null {
  try {
    const s = globalThis.localStorage
    const probe = "__sv__"
    s.setItem(probe, probe)
    s.removeItem(probe)
    return s
  } catch {
    return null
  }
}

export function saveHint(hint: SoverityHint): void {
  const s = safeStorage()
  if (!s) return
  try {
    s.setItem(KEY, JSON.stringify(hint))
  } catch {
    /* quota or privacy mode — non-fatal */
  }
}

export function loadHint(): SoverityHint | null {
  const s = safeStorage()
  if (!s) return null
  try {
    const raw = s.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SoverityHint
    if (!parsed?.username || !parsed?.avatarUrl) return null
    return parsed
  } catch {
    return null
  }
}

/** Clear the cached hint — called on sign out. */
export function clearHint(): void {
  safeStorage()?.removeItem(KEY)
}

/** Whether the user has disabled profile preview on sign-in buttons. */
const PREF_KEY = "soverity:profile-preview"

export function profilePreviewEnabled(): boolean {
  const s = safeStorage()
  if (!s) return true
  return s.getItem(PREF_KEY) !== "off"
}

export function setProfilePreview(enabled: boolean): void {
  safeStorage()?.setItem(PREF_KEY, enabled ? "on" : "off")
}
