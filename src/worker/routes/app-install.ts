import { Hono } from "hono";
import type { AppIconName } from "../../shared/types";
import { appIconsStatus, getAppIcon } from "../db/app-icons";
import { getSettings } from "../db/settings";
import { NEUTRAL_ICON_PNG } from "../lib/neutral-icons";
import type { AppEnv } from "../types";

// Installing the app on phones and computers (Stage 13, requirements C42). Public, like the branding (no session: the
// browser fetches these to install, and iPhone's home screen fetches the icon). wrangler.jsonc sends these paths to
// the Worker before the static files.
//   GET /manifest.webmanifest   the web app manifest, named from Church settings (never hardcoded)
//   GET /app-icons/<name>.png   icon-192, icon-512, maskable-512, apple-touch-icon: made from the logo mark (Church
//                               settings), or the neutral purple icon until then

/** The page colours, as in styles.css (Dark, the default): the splash background and the browser bar. */
const BACKGROUND = "#050505";
const THEME = "#0a0a0a";

const FILES: Record<string, { icon: AppIconName; neutral: 192 | 512 }> = {
  "icon-192.png": { icon: "icon-192", neutral: 192 },
  "icon-512.png": { icon: "icon-512", neutral: 512 },
  "maskable-512.png": { icon: "maskable-512", neutral: 512 },
  "apple-touch-icon.png": { icon: "apple-touch-icon", neutral: 192 },
};

const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));

export const installRoutes = new Hono<AppEnv>()
  .get("/manifest.webmanifest", async (c) => {
    const db = c.env.DB;
    const s = await getSettings(db, ["church_short_name", "app_name", "home_screen_name"]);
    const shortName = s.church_short_name?.trim() || null;
    const appName = s.app_name?.trim() || null;
    // The full name in install prompts and app lists ("IFC Pre-Service Checklist"); the home screen label is the
    // "Home screen name" setting, else the short name. Anything missing is left out, never filled in from code.
    const name = [shortName, appName].filter(Boolean).join(" ") || null;
    const label = s.home_screen_name?.trim() || shortName || appName;
    // The icons' date in their address, so a new logo mark reaches phones that cached the old one.
    const { updatedAt } = await appIconsStatus(db);
    const v = updatedAt ? `?v=${Date.parse(updatedAt)}` : "";
    const manifest = {
      id: "/",
      ...(name ? { name } : {}),
      ...(label ? { short_name: label } : {}),
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: BACKGROUND,
      theme_color: THEME,
      icons: [
        { src: `/app-icons/icon-192.png${v}`, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: `/app-icons/icon-512.png${v}`, sizes: "512x512", type: "image/png", purpose: "any" },
        { src: `/app-icons/maskable-512.png${v}`, sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    };
    return c.body(JSON.stringify(manifest), 200, { "Content-Type": "application/manifest+json", "Cache-Control": "no-cache" });
  })
  .get("/app-icons/:file", async (c) => {
    const file = FILES[c.req.param("file")];
    if (!file) return c.json({ error: "Not found" }, 404);
    const stored = await getAppIcon(c.env.DB, file.icon);
    const body = stored ?? fromBase64(NEUTRAL_ICON_PNG[file.neutral]);
    // Short caching: the manifest's ?v= changes with new icons, but iPhone asks for apple-touch-icon.png plainly.
    return c.body(body, 200, { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" });
  });
