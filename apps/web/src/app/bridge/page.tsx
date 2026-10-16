"use client"

/**
 * /bridge — the postMessage hint endpoint embedded as an iframe by the SDK
 * on third-party dApps. Serves ONLY the three display fields (avatar,
 * username, optional ENS) from the first-party session — the dApp can
 * never read the DID, address, or credentials through this bridge.
 *
 * Implemented as a client component with useEffect so no
 * dangerouslySetInnerHTML is needed (CSP-friendly, lint-clean).
 */
import { useEffect } from "react"

export default function Bridge() {
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data !== "soverity:probe") return
      let hint: { avatarUrl: string; username: string; ensName?: string } | null = null
      try {
        hint = JSON.parse(localStorage.getItem("soverity:hint") || "null")
      } catch {
        hint = null
      }
      // Reply ONLY to the probing window, with only display fields.
      ;(event.source as Window | null)?.postMessage(
        { type: "soverity:hint", hint: hint ? [hint] : [] },
        { targetOrigin: event.origin },
      )
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  return null
}
