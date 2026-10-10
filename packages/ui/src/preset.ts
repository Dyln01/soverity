import type { Config } from "tailwindcss"

/**
 * Tailwind preset mapping the Soverity glass tokens onto theme keys.
 * Usage in tailwind.config.ts:
 *   import soverityPreset from "@soverity/ui/preset";
 *   export default { presets: [soverityPreset], content: [...] } satisfies Config;
 */
const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        base: "var(--sv-base)",
        glass: {
          DEFAULT: "var(--sv-glass)",
          raised: "var(--sv-glass-raised)",
          floating: "var(--sv-glass-floating)",
        },
        border: {
          soft: "var(--sv-border-soft)",
          strong: "var(--sv-border-strong)",
        },
        accent: {
          teal: "var(--sv-teal)",
          indigo: "var(--sv-indigo)",
        },
        content: {
          primary: "var(--sv-text)",
          secondary: "var(--sv-text-secondary)",
          muted: "var(--sv-text-muted)",
        },
        success: "var(--sv-success)",
        warning: "var(--sv-warning)",
        danger: "var(--sv-danger)",
      },
      borderRadius: {
        card: "var(--sv-radius-card)",
        pill: "var(--sv-radius-pill)",
      },
      blur: {
        sm: "var(--sv-blur-sm)",
        md: "var(--sv-blur-md)",
        lg: "var(--sv-blur-lg)",
      },
      fontFamily: {
        display: ["General Sans", "Söhne", "Inter", "sans-serif"],
        ui: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        xs: "var(--sv-text-xs)",
        sm: "var(--sv-text-sm)",
        md: "var(--sv-text-md)",
        lg: "var(--sv-text-lg)",
        xl: "var(--sv-text-xl)",
        "2xl": "var(--sv-text-2xl)",
        "3xl": "var(--sv-text-3xl)",
        "4xl": "var(--sv-text-4xl)",
      },
      transitionTimingFunction: {
        spring: "var(--sv-ease-spring)",
      },
      transitionDuration: {
        hover: "150ms",
        page: "250ms",
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
      },
      minWidth: {
        touch: "44px",
      },
      minHeight: {
        touch: "44px",
      },
    },
  },
}

export default preset
