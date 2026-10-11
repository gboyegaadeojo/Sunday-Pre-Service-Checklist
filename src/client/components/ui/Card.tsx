import type { HTMLAttributes } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  /**
   * "glass" for a card that sits over the backdrop only, never in a list (design.md §2, Surfaces): the Checklist and
   * Progress summaries. Solid otherwise. With glass effects off it falls back to the solid card colour.
   */
  surface?: "solid" | "glass";
}

export function Card({ surface = "solid", className = "", ...rest }: Props) {
  const look = surface === "glass" ? "glass rounded-glass [--surface-solid:var(--c-card)]" : "rounded-card border border-line bg-card";
  return <div className={`${look} ${className}`} {...rest} />;
}
