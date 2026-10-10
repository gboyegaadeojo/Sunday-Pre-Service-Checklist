import { Hono } from "hono";
import type { BrandingResponse } from "../../shared/types";
import { getSettings } from "../db/settings";
import type { AppEnv } from "../types";

// Public on purpose: the sign-in screen shows the branding before anyone signs in.
// Returns only these display names, nothing else from settings. An empty value (cleared by an admin) is null,
// so it's left out of the display (US-11a).
export const brandingRoutes = new Hono<AppEnv>().get("/", async (c) => {
  const s = await getSettings(c.env.DB, ["church_short_name", "team_name", "app_name"] as const);
  return c.json<BrandingResponse>({ shortName: s.church_short_name || null, teamName: s.team_name || null, appName: s.app_name || null });
});
