// WCAG AA for the colour tokens (design.md §2, requirements C40): every text colour on every surface it can sit on,
// in Dark and Light, read straight from styles.css so a token change can't quietly break contrast.
// - Solid surfaces: page, panel, surface and card colours.
// - The backdrop at its strongest: each colour field, and two overlapping, over the page colour (text directly on the page).
// - Glass over any point of the backdrop.
// - Bar (floats over scrolling content) over the backdrop or anything in the content: only primary and secondary text
//   are allowed on bars, so only those are checked there. Blur only averages what's behind, so a solid area of the
//   worst colour directly behind the text is the worst case.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Read from disk: Vitest hands CSS imports to tests as empty strings.
const css = readFileSync("src/client/styles.css", "utf8").replace(/\r\n/g, "\n");

type RGB = [number, number, number];
type RGBA = [number, number, number, number];

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No ${selector} block in styles.css`);
  const body = css.slice(start, css.indexOf("\n}", start));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

function color(value: string): RGBA {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map((i) => Number.parseInt(hex[1].slice(i, i + 2), 16)).concat(1) as RGBA;
  const rgb = value.match(/^rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)$/);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] === undefined ? 1 : Number(rgb[4])];
  throw new Error(`Can't read the colour ${value}`);
}

const over = ([r, g, b, a]: RGBA, under: RGB): RGB => [r * a + under[0] * (1 - a), g * a + under[1] * (1 - a), b * a + under[2] * (1 - a)];
const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: RGB) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a: RGB, b: RGB) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const solid = (v: string): RGB => color(v).slice(0, 3) as RGB;

const THEMES = { dark: block(':root,\n[data-theme="dark"]'), light: block('[data-theme="light"]') };
const TEXT = ["--c-fg", "--c-fg-muted", "--c-accent-soft", "--c-success", "--c-warning", "--c-danger"];
const BAR_TEXT = ["--c-fg", "--c-fg-muted"];

describe.each(Object.entries(THEMES))("%s theme", (_, t) => {
  const base = solid(t["--bd-base"]);
  const fields = ["--bd-1", "--bd-2", "--bd-3"].map((k) => color(t[k]));
  // The page under the backdrop, each colour field at its strongest, and every two of them overlapping.
  const backdrop: RGB[] = [base, ...fields.map((f) => over(f, base))];
  for (let i = 0; i < fields.length; i++) for (let j = i + 1; j < fields.length; j++) backdrop.push(over(fields[j], over(fields[i], base)));

  const worst = (texts: string[], unders: RGB[]) =>
    Object.fromEntries(texts.map((k) => [k, Math.min(...unders.map((u) => contrast(solid(t[k]), u)))]));
  const expectAA = (ratios: Record<string, number>) => {
    for (const [k, r] of Object.entries(ratios)) expect(r, `${k} at ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  };

  it("every text colour passes on the solid surfaces", () => {
    expectAA(worst(TEXT, ["--c-bg", "--c-panel", "--c-surface", "--c-card"].map((k) => solid(t[k]))));
  });

  it("every text colour passes directly on the backdrop, at its strongest", () => {
    expectAA(worst(TEXT, backdrop));
  });

  it("every text colour passes on glass over any part of the backdrop", () => {
    expectAA(worst(TEXT, backdrop.map((u) => over(color(t["--glass-bg"]), u))));
  });

  it("primary and secondary text pass on a bar over the backdrop or anything that scrolls under it", () => {
    const content = ["--c-card", "--c-accent", "--c-success", "--c-warning", "--c-danger", "--c-fg"].map((k) => solid(t[k]));
    expectAA(worst(BAR_TEXT, [...backdrop, ...content].map((u) => over(color(t["--bar-bg"]), u))));
  });

  it("the text on the danger button passes", () => {
    expect(contrast(solid(t["--c-on-danger"]), solid(t["--c-danger"]))).toBeGreaterThanOrEqual(4.5);
  });
});
