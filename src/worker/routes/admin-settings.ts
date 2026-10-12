import { Hono } from "hono";
import { isTimeZone } from "../../shared/service-day";
import {
  APP_ICONS,
  type ApiErrorBody,
  type AppIconName,
  BRANDING_MAX,
  type ChurchSettings,
  HOME_SCREEN_NAME_MAX,
  SHORT_NAME_MAX,
  type SettingsEditsResponse,
  type SettingsResponse,
  type UpdateSettingsResponse,
  type UploadAppIconsRequest,
} from "../../shared/types";
import { appIconsStatus, saveAppIcons } from "../db/app-icons";
import { currentServiceDay } from "../db/services";
import { getChurchSettings, getSettingsEvents, updateChurchSettings } from "../db/settings";
import { actorFor } from "../lib/actor";
import { requireAdmin } from "../middleware/auth";
import type { AppEnv } from "../types";

// Church settings (Stage 5d.2, US-11a). Admins only, enforced here.
//   GET /api/admin/settings          every setting, plus the current service date and how many tasks are checked on it
//   PUT /api/admin/settings          { timeZone, serviceWeekday, shortName, teamName, appName, homeScreenName }  saves what changed
//   GET /api/admin/settings/events   the append-only settings log, newest first
//   PUT /api/admin/settings/app-icons { shortName, icons }  the app icons drawn from the logo mark (Stage 13): four
//                                    PNGs as base64, for the current short name only
// The branding is also public through GET /api/branding; nothing else here is.

type Fields = ChurchSettings & { serviceWeekday: number };

/** The validated, trimmed settings from the body, or an error message. */
function readSettings(body: Record<string, unknown>): Fields | { error: string } {
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const timeZone = text(body.timeZone);
  const shortName = text(body.shortName);
  const teamName = text(body.teamName);
  const appName = text(body.appName);
  const homeScreenName = text(body.homeScreenName);
  const weekday = body.serviceWeekday;
  if (!isTimeZone(timeZone)) return { error: "Choose a time zone from the list, e.g. America/Winnipeg." };
  if (!(typeof weekday === "number" && Number.isInteger(weekday) && weekday >= 0 && weekday <= 6)) {
    return { error: "Choose the service day." };
  }
  if (shortName.length > SHORT_NAME_MAX) return { error: `Short name can be at most ${SHORT_NAME_MAX} characters.` };
  if (teamName.length > BRANDING_MAX) return { error: `Team name can be at most ${BRANDING_MAX} characters.` };
  if (appName.length > BRANDING_MAX) return { error: `App name can be at most ${BRANDING_MAX} characters.` };
  if (homeScreenName.length > HOME_SCREEN_NAME_MAX) return { error: `Home screen name can be at most ${HOME_SCREEN_NAME_MAX} characters.` };
  return { timeZone, serviceWeekday: weekday, shortName, teamName, appName, homeScreenName };
}

/** Largest icon accepted: a 512px flat icon is a few kilobytes; this leaves plenty of room. */
const ICON_MAX_BYTES = 300_000;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/** The icons as bytes, checked to be PNGs of a sensible size, or an error message. */
function readIcons(body: Partial<UploadAppIconsRequest> | null): Record<AppIconName, Uint8Array> | string {
  if (!body?.icons || typeof body.icons !== "object") return "Send the icons.";
  const icons = {} as Record<AppIconName, Uint8Array>;
  for (const name of APP_ICONS) {
    const b64 = (body.icons as Record<string, unknown>)[name];
    if (typeof b64 !== "string") return `The ${name} icon is missing.`;
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
    } catch {
      return `The ${name} icon isn't a PNG.`;
    }
    if (bytes.length > ICON_MAX_BYTES || !PNG_SIGNATURE.every((b, i) => bytes[i] === b)) return `The ${name} icon isn't a PNG.`;
    icons[name] = bytes;
  }
  return icons;
}

export const adminSettingsRoutes = new Hono<AppEnv>()
  .use(requireAdmin)
  .put("/app-icons", async (c) => {
    const body = (await c.req.json().catch(() => null)) as Partial<UploadAppIconsRequest> | null;
    const icons = readIcons(body);
    if (typeof icons === "string") return c.json<ApiErrorBody>({ error: icons }, 400);
    // Only icons showing the current short name: a stale tab can't put an old name back on everyone's home screen.
    const { shortName } = await appIconsStatus(c.env.DB);
    if (!shortName || body?.shortName?.trim() !== shortName) {
      return c.json<ApiErrorBody>({ error: "The short name has changed since. Reload and try again." }, 409);
    }
    await saveAppIcons(c.env.DB, shortName, icons);
    return c.body(null, 204);
  })
  .get("/", async (c) => {
    const db = c.env.DB;
    const settings = await getChurchSettings(db);
    // Read only: the current service row is created by the checklist, not by looking at settings.
    let currentService: SettingsResponse["currentService"] = null;
    if (isTimeZone(settings.timeZone) && settings.serviceWeekday !== null) {
      // A published plan's date, or the service day (US-07).
      const { date, fromPlan } = await currentServiceDay(db, new Date());
      // Active check-offs only: unchecked and reset ones aren't progress anyone would lose sight of.
      const row = await db
        .prepare(
          `SELECT COUNT(*) AS n FROM checkoffs k JOIN services s ON s.id = k.service_id
            WHERE s.service_date = ?1 AND k.unchecked_at IS NULL AND k.reset_id IS NULL`,
        )
        .bind(date)
        .first<{ n: number }>();
      currentService = { date, checkedCount: row?.n ?? 0, fromPlan };
    }
    const icons = await appIconsStatus(db);
    const appIcons = icons.updatedAt ? { updatedAt: icons.updatedAt, shortName: icons.shortName } : null;
    return c.json<SettingsResponse>({ settings, currentService, appIcons });
  })
  .put("/", async (c) => {
    const body = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const fields = readSettings(body);
    if ("error" in fields) return c.json<ApiErrorBody>({ error: fields.error }, 400);
    const changed = await updateChurchSettings(c.env.DB, actorFor(c), fields);
    const { date } = await currentServiceDay(c.env.DB, new Date());
    return c.json<UpdateSettingsResponse>({ changed, currentServiceDate: date });
  })
  .get("/events", async (c) => c.json<SettingsEditsResponse>(await getSettingsEvents(c.env.DB)));
