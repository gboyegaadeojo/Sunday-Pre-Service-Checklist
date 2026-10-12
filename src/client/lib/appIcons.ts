import type { AppIconName } from "../../shared/types";

// The installed app's icons (Stage 13, requirements C42), drawn in the Admin's browser from the logo mark as the header
// shows it: the short name (a setting) in white, bold, on the accent purple. Drawing here means the Worker only stores
// and serves bytes. The colour comes from the theme tokens (the Dark theme's accent), never written into the code.

interface Spec {
  size: number;
  /** "rounded": an app tile with transparent corners; "full": edge to edge (the system rounds or masks it). */
  shape: "rounded" | "full";
  /** How much of the width the text may take: less for the maskable icon, whose edges may be cut to a circle. */
  textWidth: number;
}

const SPECS: Record<AppIconName, Spec> = {
  "icon-192": { size: 192, shape: "rounded", textWidth: 0.68 },
  "icon-512": { size: 512, shape: "rounded", textWidth: 0.68 },
  "maskable-512": { size: 512, shape: "full", textWidth: 0.5 },
  "apple-touch-icon": { size: 180, shape: "full", textWidth: 0.62 },
};

/** The Dark theme's accent, read from the tokens (styles.css), whatever theme this page shows. */
function accent(): string {
  const probe = document.createElement("div");
  probe.dataset.theme = "dark";
  probe.hidden = true;
  document.body.append(probe);
  const value = getComputedStyle(probe).getPropertyValue("--c-accent").trim();
  probe.remove();
  return value;
}

function draw(text: string, spec: Spec, color: string, font: string): string {
  const { size } = spec;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx || !color) throw new Error("This browser can't draw the app icon.");
  ctx.fillStyle = color;
  if (spec.shape === "rounded") {
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, size * 0.22);
    ctx.fill();
  } else {
    ctx.fillRect(0, 0, size, size);
  }
  // As large as fits: start at 42% of the icon and shrink to the allowed width.
  let px = size * 0.42;
  ctx.font = `700 ${px}px ${font}`;
  const width = ctx.measureText(text).width;
  if (width > size * spec.textWidth) {
    px *= (size * spec.textWidth) / width;
    ctx.font = `700 ${px}px ${font}`;
  }
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, size / 2, size * 0.53);
  return canvas.toDataURL("image/png").split(",")[1];
}

/** Every icon as base64 PNG, for PUT /api/admin/settings/app-icons. Throws if this browser can't draw. */
export function drawAppIcons(shortName: string): Record<AppIconName, string> {
  const color = accent();
  const font = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  return Object.fromEntries(Object.entries(SPECS).map(([name, spec]) => [name, draw(shortName, spec, color, font)])) as Record<
    AppIconName,
    string
  >;
}
