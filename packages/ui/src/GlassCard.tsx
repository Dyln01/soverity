import * as React from "react";

export type Elevation = "base" | "raised" | "floating";

const elevationClass: Record<Elevation, string> = {
  base: "sv-glass",
  raised: "sv-glass-raised",
  floating: "sv-glass-floating",
};

/**
 * The core glass card: translucent surface, medium blur + saturation,
 * 1px soft border, 20px radius, top-edge specular highlight, inner teal
 * glow. Everything in the Soverity UI sits on one of these.
 */
export function GlassCard({
  elevation = "base",
  glow,
  interactive = false,
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  elevation?: Elevation;
  glow?: "teal" | "indigo" | "none";
  interactive?: boolean;
}) {
  const glowClass =
    glow === "teal" ? "sv-glow-teal-edge" : glow === "indigo" ? "sv-glow-indigo-edge" : "";

  return (
    <div
      className={`sv-focus ${elevationClass[elevation]} ${interactive ? "sv-lift" : ""} ${glowClass} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
