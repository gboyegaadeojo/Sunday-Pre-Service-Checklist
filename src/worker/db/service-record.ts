import { InvalidSettingError, currentServiceDate } from "../../shared/service-day";
import { getCalendarSettings } from "./services";

// The record of each service's checklist (US-07b, migration 0007): every task that was on it while the service
// was current, so history can show "X of Y done" and what wasn't checked. Only the *current* service's record is
// ever written. Once its date has passed (midnight, church time zone) it is no longer current, so its record
// stops changing without anything having to run at midnight.

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/**
 * Adds the live tasks of the matched service(s) to their record, or updates their text and place (only rows
 * that changed are written), and brings back any that were removed. `where` selects services rows `sv`.
 */
const upsertSql = (where: string) => `
  INSERT INTO service_tasks
    (service_id, task_id, text, category_id, category_name, category_order, section_id, section_name, section_order, task_order)
  SELECT sv.id, t.id, t.text, c.id, c.name, c.sort_order, s.id, s.name, s.sort_order, t.sort_order
    FROM services sv
    JOIN categories c ON c.list_id = sv.list_id AND c.deleted_at IS NULL
    JOIN sections s ON s.category_id = c.id AND s.deleted_at IS NULL
    JOIN tasks t ON t.section_id = s.id AND t.deleted_at IS NULL
   WHERE ${where}
  ON CONFLICT (service_id, task_id) DO UPDATE SET
    text = excluded.text, category_id = excluded.category_id, category_name = excluded.category_name,
    category_order = excluded.category_order, section_id = excluded.section_id, section_name = excluded.section_name,
    section_order = excluded.section_order, task_order = excluded.task_order, removed_at = NULL
  WHERE text <> excluded.text OR category_id <> excluded.category_id OR category_name <> excluded.category_name
     OR category_order <> excluded.category_order OR section_id <> excluded.section_id OR section_name <> excluded.section_name
     OR section_order <> excluded.section_order OR task_order <> excluded.task_order OR removed_at IS NOT NULL`;

/** Marks tasks no longer on the matched services' checklists (hidden, or in a hidden section/department) as removed. */
const markRemovedSql = (serviceIds: string) => `
  UPDATE service_tasks SET removed_at = ${NOW}
   WHERE removed_at IS NULL AND service_id IN (${serviceIds})
     AND task_id NOT IN (
       SELECT t.id FROM tasks t
         JOIN sections s ON s.id = t.section_id AND s.deleted_at IS NULL
         JOIN categories c ON c.id = s.category_id AND c.deleted_at IS NULL
        WHERE t.deleted_at IS NULL AND c.list_id = (SELECT list_id FROM services WHERE id = service_tasks.service_id))`;

const CURRENT = "SELECT id FROM services WHERE service_date = ?1 AND tasks_recorded_from IS NOT NULL";

/**
 * Two statements that bring the current service's record up to date with the live checklist. Checklist edits
 * append them to their own db.batch, so the edit and the record change together or not at all. Empty when the
 * calendar settings are invalid (there's no current service then).
 */
export async function syncRecordStatements(db: D1Database, now = new Date()): Promise<D1PreparedStatement[]> {
  let date: string;
  try {
    const { timeZone, weekday } = await getCalendarSettings(db);
    date = currentServiceDate(now, timeZone, weekday).date;
  } catch (err) {
    if (err instanceof InvalidSettingError) return [];
    throw err;
  }
  return [
    db.prepare(upsertSql(`sv.id IN (${CURRENT})`)).bind(date),
    db.prepare(markRemovedSql(CURRENT)).bind(date),
  ];
}

/**
 * Starts the record of a service that has none yet: a new service, or the one that was current when this
 * feature shipped (its record starts partway through). Runs once per service: the UPDATE claims it, and the
 * seed runs only if that claim changed the row.
 */
export const startRecordStatements = (db: D1Database, serviceId: number) => [
  db.prepare(`UPDATE services SET tasks_recorded_from = ${NOW} WHERE id = ?1 AND tasks_recorded_from IS NULL`).bind(serviceId),
  db.prepare(upsertSql("sv.id = ?1 AND changes() = 1")).bind(serviceId),
];

/**
 * After the current service switches to another list (allowed only before anything is checked, US-11): the
 * record starts over from the new list. The statements run only if the switch (the statement before) happened.
 */
export const restartRecordStatements = (db: D1Database, serviceId: number) => [
  db.prepare("DELETE FROM service_tasks WHERE service_id = ?1 AND changes() = 1").bind(serviceId),
  db.prepare(upsertSql("sv.id = ?1 AND sv.tasks_recorded_from IS NOT NULL")).bind(serviceId),
];
