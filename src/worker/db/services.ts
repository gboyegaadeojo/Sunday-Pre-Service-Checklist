import { InvalidSettingError, assertTimeZone, currentServiceDate, localDate, parseWeekday } from "../../shared/service-day";
import { cached } from "../sources/cache";
import { ProviderUnavailableError } from "../sources/identity";
import type { ScheduleSource, SourcePlan } from "../sources/schedule";
import { getServiceTypeId } from "./mapping";
import { startRecordStatements } from "./service-record";
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
  /** The schedule source couldn't be reached just now, so the date and plan are the last known (US-04a). */
  scheduleUnavailable?: boolean;
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

/** The earliest service dated today or later with a recorded plan, if any (see currentServiceDay). */
const plannedFrom = (db: D1Database, today: string) =>
  db
    .prepare("SELECT service_date FROM services WHERE plan_external_id IS NOT NULL AND service_date >= ? ORDER BY service_date LIMIT 1")
    .bind(today)
    .first<{ service_date: string }>();

/**
 * The current service's date, from the database alone (US-07): the earliest service dated today or later that has a
 * recorded plan, or else the next service day (today, if today is the service day). Used everywhere that must agree
 * with getCurrentService without asking the schedule source: the service record, history, the activity log and
 * Settings. getCurrentService keeps the recorded plans in step with the source, so the two agree; it also serves as
 * the outage fallback. `fromPlan`: the date comes from a published plan.
 */
export async function currentServiceDay(
  db: D1Database,
  now: Date,
): Promise<{ date: string; today: string; timeZone: string; fromPlan: boolean }> {
  const { timeZone, weekday } = await getCalendarSettings(db);
  const today = localDate(now, timeZone).date;
  const planned = await plannedFrom(db, today);
  return planned
    ? { date: planned.service_date, today, timeZone, fromPlan: true }
    : { date: currentServiceDate(now, timeZone, weekday).date, today, timeZone, fromPlan: false };
}

/**
 * The current service (US-07): the schedule source's earliest plan dated today or later, in the Service Type an Admin
 * chose (US-15); with no plan published, the next service day. A service stays current until midnight after its date
 * (church time zone). Created on first use with the default list at that moment, with its plan recorded, and the
 * record of its checklist started (US-07b). Plans no longer published are cleared from upcoming services, so
 * currentServiceDay agrees.
 *
 * Without a source or a chosen Service Type, or while the source can't be reached (`scheduleUnavailable`), the date
 * comes from the database (currentServiceDay): a plan recorded earlier still counts (US-04a).
 * Returns null when no service exists yet for the date and there is no default list to create it from.
 */
export async function getCurrentService(db: D1Database, now: Date, source: ScheduleSource | null = null): Promise<Service | null> {
  const { timeZone, weekday } = await getCalendarSettings(db);
  const today = localDate(now, timeZone).date;

  // Ask the source for the earliest plan from today (cached a few minutes).
  const serviceTypeId = source && (await getServiceTypeId(db, source));
  let plan: SourcePlan | null = null;
  let known = false; // the source answered
  let unavailable = false;
  if (source && serviceTypeId) {
    try {
      plan = await cached<SourcePlan | null>(db, `${source.id}:plan:${serviceTypeId}:${today}`, () => source.nextPlan(serviceTypeId, today));
      known = true;
    } catch (err) {
      if (!(err instanceof ProviderUnavailableError)) throw err;
      unavailable = true;
    }
  }
  const date = known
    ? (plan?.date ?? currentServiceDate(now, timeZone, weekday).date)
    : (await currentServiceDay(db, now)).date;

  const statements = [
    db
      .prepare(
        `INSERT OR IGNORE INTO services (service_date, list_id)
         SELECT ?1, id FROM task_lists WHERE is_default = 1 AND deleted_at IS NULL`,
      )
      .bind(date),
  ];
  if (known && source) {
    statements.push(
      // Upcoming services keep only plans the source still publishes (none, or this one).
      db
        .prepare(
          `UPDATE services SET plan_source = NULL, plan_external_id = NULL
            WHERE plan_external_id IS NOT NULL AND service_date >= ?1 AND (service_date <> ?2 OR plan_external_id IS NOT ?3)`,
        )
        .bind(today, date, plan?.externalId ?? null),
    );
    if (plan) {
      statements.push(
        db
          .prepare("UPDATE services SET plan_source = ?2, plan_external_id = ?3 WHERE service_date = ?1 AND plan_external_id IS NOT ?3")
          .bind(date, source.id, plan.externalId),
      );
    }
  }
  statements.push(db.prepare("SELECT id, service_date, list_id, plan_external_id, tasks_recorded_from FROM services WHERE service_date = ?1").bind(date));

  const results = await db.batch(statements);
  const row = results.at(-1)?.results[0] as
    | { id: number; service_date: string; list_id: number; plan_external_id: string | null; tasks_recorded_from: string | null }
    | undefined;
  if (!row) return null;
  if (row.tasks_recorded_from === null) await db.batch(startRecordStatements(db, row.id));
  return {
    id: row.id,
    date: row.service_date,
    listId: row.list_id,
    planExternalId: row.plan_external_id,
    isToday: row.service_date === today,
    timeZone,
    ...(unavailable ? { scheduleUnavailable: true } : {}),
  };
}
