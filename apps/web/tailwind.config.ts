import type { Config } from "tailwindcss";
import soverityPreset from "@soverity/ui/preset";

export default {
  presets: [soverityPreset],
  content: [
    "./src/**/*.{ts,tsx,mdx}",
    "./src/app/**/*.{ts,tsx,mdx}",
    "../../packages/sdk/src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}"
  ],
} satisfies Config;
