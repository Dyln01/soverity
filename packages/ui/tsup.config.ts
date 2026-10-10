import { defineConfig } from "tsup"

const shared = {
  entry: ["src/index.ts", "src/preset.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
} as const

export default defineConfig([shared])
