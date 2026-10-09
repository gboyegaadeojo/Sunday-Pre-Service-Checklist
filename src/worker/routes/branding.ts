import { Hono } from "hono";
import type { BrandingResponse } from "../../shared/types";
import { getSettings } from "../db/settings";
import type { AppEnv } from "../types";

// Public on purpose: the sign-in screen shows the branding before anyone signs in.
// Returns only these display names, nothing else from settings.
export const brandingRoutes = new Hono<AppEnv>().get("/", async (c) => {
  const s = await getSettings(c.env.DB, ["church_short_name", "team_name", "app_name"] as const);
  return c.json<BrandingResponse>({ shortName: s.church_short_name, teamName: s.team_name, appName: s.app_name });
});
