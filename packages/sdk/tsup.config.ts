import { defineConfig } from "tsup";

const common = {
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: "es2022",
} as const;

export default defineConfig([
  // library entries
  {
    ...common,
    entry: { index: "src/index.ts", server: "src/server/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    external: ["react", "react-dom", "react/jsx-runtime", "react-dom/client"],
    outDir: "dist",
  },
  // UMD bundle for the script-tag build
  {
    ...common,
    entry: { "sdk.umd": "src/vanilla.ts" },
    format: ["umd"],
    globalName: "Soverity",
    outDir: "dist",
    footer: {
      // auto-mount data attributes
      js: `if (typeof document !== "undefined") {
  document.querySelectorAll("[data-soverity-button]").forEach(function (el) {
    try { Soverity.mount(el, JSON.parse(el.getAttribute("data-soverity") || "{}")); } catch (e) {}
  });
}`,
    },
  },
]);
