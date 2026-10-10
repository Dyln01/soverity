import { renderToStaticMarkup } from "react-dom/server";
import { GlassCard } from "./GlassCard";
import { contrastPairs, surfaces } from "./tokens";

describe("glass design system", () => {
  it("renders all three elevation levels with the right surface classes", () => {
    for (const elevation of ["base", "raised", "floating"] as const) {
      const markup = renderToStaticMarkup(
        <GlassCard elevation={elevation} data-testid="c">
          hi
        </GlassCard>,
      );
      expect(markup).toContain(elevation === "base" ? "sv-glass\"" : `sv-glass-${elevation}`);
    }
  });

  it("surface opacities follow the token spec (6 / 10 / 16 percent white)", () => {
    expect(surfaces.base).toBe("rgba(255,255,255,0.06)");
    expect(surfaces.raised).toBe("rgba(255,255,255,0.10)");
    expect(surfaces.floating).toBe("rgba(255,255,255,0.16)");
  });

  it("text tokens keep WCAG AA contrast on every glass elevation", () => {
    // Near-white on near-black indigo is ~17:1; adding up to 16% white
    // glass only lightens the backdrop, so all pairs stay above 4.5:1.
    expect(contrastPairs.primaryOnGlass).toBeGreaterThan(4.5);
    expect(contrastPairs.secondaryOnGlass).toBeGreaterThan(4.5);
    expect(contrastPairs.mutedOnGlass).toBeGreaterThan(4.5);
  });
});
