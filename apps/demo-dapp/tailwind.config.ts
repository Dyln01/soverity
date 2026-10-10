import soverityPreset from "@soverity/ui/preset"
import type { Config } from "tailwindcss"

export default {
  presets: [soverityPreset],
  content: ["./src/**/*.{ts,tsx}"],
} satisfies Config
