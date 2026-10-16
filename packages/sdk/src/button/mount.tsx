import type * as React from "react"
import type { Root } from "react-dom/client"
import { SoverityButton } from "./SoverityButton"

/**
 * React mount for the vanilla entry — used when window.React exists.
 * Uses the app's own React instance to avoid double-React issues.
 */

const roots = new WeakMap<HTMLElement, Root>()

export function mount(
  selector: string | HTMLElement,
  props: React.ComponentProps<typeof SoverityButton>,
  ReactInstance: typeof React,
  ReactDOMClient: { createRoot: (el: HTMLElement) => Root },
) {
  const target = typeof selector === "string" ? document.querySelector(selector) : selector
  if (!target) throw new Error(`Soverity: no element matches ${String(selector)}`)
  const root = ReactDOMClient.createRoot(target as HTMLElement)
  roots.set(target as HTMLElement, root)
  root.render(ReactInstance.createElement(SoverityButton, props))
  return { unmount: () => root.unmount() }
}

export function unmount(target: HTMLElement) {
  roots.get(target)?.unmount()
  roots.delete(target)
}
