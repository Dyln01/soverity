import type { Config } from "tailwindcss";
import soverityPreset from "@soverity/ui/preset";

export default {
  presets: [soverityPreset],
  content: ["./src/**/*.{ts,tsx}"],
} satisfies Config;
