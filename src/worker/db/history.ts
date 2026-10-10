import { currentServiceDate } from "../../shared/service-day";
import type { HistoryCategory, HistoryResponse, ServiceHistoryResponse, ServiceSummary } from "../../shared/types";
import { ACTIVE } from "./checkoffs";
import { getCalendarSettings } from "./services";

// Service history (Stage 5d.3, design.md §7, US-07). Read-only. Past check-offs are shown from their snapshots
// (task text, department and section at check-off time; US-06, US-13), so later edits, moves and hides never
// change them. Hidden departments, sections, tasks and lists still show here.

const PAGE = 200;

const SUMMARY_COLUMNS = `s.id, s.service_date, s.list_id, l.name AS list_name, l.deleted_at IS NOT NULL AS list_hidden,
  (SELECT COUNT(*) FROM checkoffs k WHERE k.service_id = s.id AND ${ACTIVE}) AS checked_count,
  (SELECT COUNT(*) FROM resets r WHERE r.service_id = s.id) AS reset_count`;

interface SummaryRow {
  id: number;
  service_date: string;
  list_id: number;
  list_name: string;
  list_hidden: number;
  checked_count: number;
  reset_count: number;
}

const toSummary = (r: SummaryRow): ServiceSummary => ({
  id: r.id,
  date: r.service_date,
  list: { id: r.list_id, name: r.list_name, hidden: r.list_hidden === 1 },
  checkedCount: r.checked_count,
  resetCount: r.reset_count,
});

/** The current service date, worked out without creating the service row (unlike getCurrentService). */
async function currentDate(db: D1Database, now: Date): Promise<{ date: string; timeZone: string }> {
  const { timeZone, weekday } = await getCalendarSettings(db);
  return { date: currentServiceDate(now, timeZone, weekday).date, timeZone };
}

/** Every service except the current one, newest date first. */
export async function getServiceHistory(db: D1Database, now: Date): Promise<HistoryResponse> {
  const { date } = await currentDate(db, now);
  const { results } = await db
    .prepare(
      `SELECT ${SUMMARY_COLUMNS} FROM services s JOIN task_lists l ON l.id = s.list_id
        WHERE s.service_date <> ?1 ORDER BY s.service_date DESC LIMIT ?2`,
    )
    .bind(date, PAGE + 1)
    .all<SummaryRow>();
  return { services: results.slice(0, PAGE).map(toSummary), truncated: results.length > PAGE };
}

interface CheckoffRow {
  task_id: number;
  task_text_snapshot: string;
  category_id_snapshot: number;
  category_name_snapshot: string;
  section_id_snapshot: number;
  section_name_snapshot: string;
  checked_by_name: string;
  checked_at: string;
}

interface ResetRow {
  id: number;
  reset_at: string;
  reset_by_name: string;
  archived_count: number;
  undone_at: string | null;
  undone_by_name: string | null;
}

/**
 * One service's record: the tasks still checked when it ended, grouped by department and section as they were
 * at check-off time, and its resets. Null if there's no such service. Departments and sections keep their
 * current display order (hidden ones included); one that was renamed during the service shows its latest name.
 */
export async function getServiceRecord(db: D1Database, serviceId: number, now: Date): Promise<ServiceHistoryResponse | null> {
  const [serviceResult, checkoffResult, resetResult] = await db.batch([
    db.prepare(`SELECT ${SUMMARY_COLUMNS} FROM services s JOIN task_lists l ON l.id = s.list_id WHERE s.id = ?`).bind(serviceId),
    db
      .prepare(
        `SELECT k.task_id, k.task_text_snapshot, k.category_id_snapshot, k.category_name_snapshot,
                k.section_id_snapshot, k.section_name_snapshot, k.checked_by_name, k.checked_at
           FROM checkoffs k
           LEFT JOIN categories c ON c.id = k.category_id_snapshot
           LEFT JOIN sections sec ON sec.id = k.section_id_snapshot
           LEFT JOIN tasks t ON t.id = k.task_id
          WHERE k.service_id = ? AND k.unchecked_at IS NULL AND k.reset_id IS NULL
          ORDER BY c.sort_order, k.category_id_snapshot, sec.sort_order, k.section_id_snapshot, t.sort_order, k.task_id`,
      )
      .bind(serviceId),
    db
      .prepare(
        `SELECT id, reset_at, reset_by_name, archived_count, undone_at, undone_by_name
           FROM resets WHERE service_id = ? ORDER BY id`,
      )
      .bind(serviceId),
  ]);
  const row = serviceResult.results[0] as SummaryRow | undefined;
  if (!row) return null;
  const { date, timeZone } = await currentDate(db, now);

  // Group by department and section ID (in query order); the newest check-off in a group names it.
  const categories: HistoryCategory[] = [];
  const latest = new Map<object, string>();
  const rename = (group: { name: string }, name: string, at: string) => {
    if ((latest.get(group) ?? "") < at) {
      latest.set(group, at);
      group.name = name;
    }
  };
  for (const r of checkoffResult.results as CheckoffRow[]) {
    let category = categories.find((c) => c.id === r.category_id_snapshot);
    if (!category) {
      category = { id: r.category_id_snapshot, name: r.category_name_snapshot, sections: [] };
      categories.push(category);
    }
    rename(category, r.category_name_snapshot, r.checked_at);
    let section = category.sections.find((s) => s.id === r.section_id_snapshot);
    if (!section) {
      section = { id: r.section_id_snapshot, name: r.section_name_snapshot, tasks: [] };
      category.sections.push(section);
    }
    rename(section, r.section_name_snapshot, r.checked_at);
    section.tasks.push({ taskId: r.task_id, text: r.task_text_snapshot, by: r.checked_by_name, at: r.checked_at });
  }

  return {
    service: { ...toSummary(row), timeZone, isCurrent: row.service_date === date },
    categories,
    resets: (resetResult.results as ResetRow[]).map((r) => ({
      id: r.id,
      at: r.reset_at,
      by: r.reset_by_name,
      archived: r.archived_count,
      undoneAt: r.undone_at,
      undoneBy: r.undone_by_name,
    })),
  };
}
