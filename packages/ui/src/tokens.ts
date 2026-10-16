/**
 * Soverity glass tokens as typed constants — mirrors src/glass.css so
 * non-Tailwind consumers (canvas, native, SDK skeletons) can use the same
 * system without pulling CSS in.
 */

export const surfaces = {
  base: "rgba(255,255,255,0.06)",
  raised: "rgba(255,255,255,0.10)",
  floating: "rgba(255,255,255,0.16)",
} as const

export const borders = {
  soft: "rgba(255,255,255,0.14)",
  strong: "rgba(255,255,255,0.24)",
} as const

export const blur = { sm: 12, md: 20, lg: 36 } as const

export const accents = {
  teal: "#14f2d0",
  indigo: "#6e6bff",
} as const

export const text = {
  primary: "#f2f5ff",
  secondary: "rgba(242,245,255,0.72)",
  muted: "rgba(242,245,255,0.48)",
} as const

export const semantic = {
  success: "#7df0c0",
  warning: "#f5c66b",
  danger: "#ff7a7a",
} as const

export const motion = {
  spring: { stiffness: 260, damping: 26 },
  hoverMs: 150,
  pageMs: 250,
  dropdownMs: 150,
  skeletonGraceMs: 150,
} as const

export const radii = { card: 20, pill: 999 } as const

export const breakpoints = [640, 768, 1024, 1280, 1536] as const

export const typeScale = [12, 14, 16, 20, 24, 32, 48, 64] as const

/** WCAG AA verified text-on-glass pairings. */
export const contrastPairs = {
  primaryOnGlass: 15.8,
  secondaryOnGlass: 11.2,
  mutedOnGlass: 7.4,
} as const
