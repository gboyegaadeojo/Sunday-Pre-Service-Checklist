import { InvalidSettingError, assertTimeZone, currentServiceDate, parseWeekday } from "../lib/service-day";
import { getSettings } from "./settings";

export interface Service {
  id: number;
  date: string;
  listId: number;
  /** The schedule source's plan for this service, or null when none is published (US-05). */
  planExternalId: string | null;
  /** True when the service date is today in the church's time zone. */
  isToday: boolean;
  timeZone: string;
}

/** The church calendar settings, validated. Missing or invalid values are an error, never defaulted in code. */
export async function getCalendarSettings(db: D1Database): Promise<{ timeZone: string; weekday: number }> {
  const s = await getSettings(db, ["time_zone", "service_weekday"] as const);
  if (s.time_zone === null || s.service_weekday === null) {
    throw new InvalidSettingError("time_zone and service_weekday settings must be set (US-11a)");
  }
  assertTimeZone(s.time_zone);
  return { timeZone: s.time_zone, weekday: parseWeekday(s.service_weekday) };
}

/**
 * The current service (US-07), created on first use with the default list at that moment.
 * Returns null when no service exists yet for the date and there is no default list to create it from.
 * Stage 7 adds plans from the schedule source (sources/schedule.ts); until then the date comes from the service-weekday setting.
 */
export async function getCurrentService(db: D1Database, now: Date): Promise<Service | null> {
  const { timeZone, weekday } = await getCalendarSettings(db);
  const { date, isToday } = currentServiceDate(now, timeZone, weekday);

  const [, select] = await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO services (service_date, list_id)
         SELECT ?1, id FROM task_lists WHERE is_default = 1 AND deleted_at IS NULL`,
      )
      .bind(date),
    db.prepare("SELECT id, service_date, list_id, plan_external_id FROM services WHERE service_date = ?1").bind(date),
  ]);
  const row = select.results[0] as { id: number; service_date: string; list_id: number; plan_external_id: string | null } | undefined;
  if (!row) return null;
  return { id: row.id, date: row.service_date, listId: row.list_id, planExternalId: row.plan_external_id, isToday, timeZone };
}
