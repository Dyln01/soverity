import type * as React from "react"

/**
 * Screen-reader-only helper text. Used to give every action an accessible
 * name without cluttering the glass surface.
 */
export function SrOnly({ children }: { children: React.ReactNode }) {
  return <span className="sv-sr-only">{children}</span>
}
