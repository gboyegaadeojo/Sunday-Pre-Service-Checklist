import { Hono } from "hono";
import { isTimeZone } from "../../shared/service-day";
import {
  type ApiErrorBody,
  BRANDING_MAX,
  type ChurchSettings,
  SHORT_NAME_MAX,
  type SettingsEditsResponse,
  type SettingsResponse,
  type UpdateSettingsResponse,
} from "../../shared/types";
import { currentServiceDay } from "../db/services";
import { getChurchSettings, getSettingsEvents, updateChurchSettings } from "../db/settings";
import { actorFor } from "../lib/actor";
import { requireAdmin } from "../middleware/auth";
import type { AppEnv } from "../types";

// Church settings (Stage 5d.2, US-11a). Admins only, enforced here.
//   GET /api/admin/settings          every setting, plus the current service date and how many tasks are checked on it
//   PUT /api/admin/settings          { timeZone, serviceWeekday, shortName, teamName, appName }  saves what changed
//   GET /api/admin/settings/events   the append-only settings log, newest first
// The branding is also public through GET /api/branding; nothing else here is.

type Fields = ChurchSettings & { serviceWeekday: number };

/** The validated, trimmed settings from the body, or an error message. */
function readSettings(body: Record<string, unknown>): Fields | { error: string } {
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const timeZone = text(body.timeZone);
  const shortName = text(body.shortName);
  const teamName = text(body.teamName);
  const appName = text(body.appName);
  const weekday = body.serviceWeekday;
  if (!isTimeZone(timeZone)) return { error: "Choose a time zone from the list, e.g. America/Winnipeg." };
  if (!(typeof weekday === "number" && Number.isInteger(weekday) && weekday >= 0 && weekday <= 6)) {
    return { error: "Choose the service day." };
  }
  if (shortName.length > SHORT_NAME_MAX) return { error: `Short name can be at most ${SHORT_NAME_MAX} characters.` };
  if (teamName.length > BRANDING_MAX) return { error: `Team name can be at most ${BRANDING_MAX} characters.` };
  if (appName.length > BRANDING_MAX) return { error: `App name can be at most ${BRANDING_MAX} characters.` };
  return { timeZone, serviceWeekday: weekday, shortName, teamName, appName };
}

export const adminSettingsRoutes = new Hono<AppEnv>()
  .use(requireAdmin)
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
    return c.json<SettingsResponse>({ settings, currentService });
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
