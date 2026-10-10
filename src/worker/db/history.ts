import { currentServiceDate } from "../../shared/service-day";
import type {
  HistoryCategory,
  HistoryCheckoff,
  HistoryResponse,
  HistoryTask,
  RemovedTask,
  ServiceHistoryResponse,
  ServiceSummary,
} from "../../shared/types";
import { ACTIVE } from "./checkoffs";
import { getCalendarSettings } from "./services";

// Service history (Stage 5d.3, design.md §7, US-07). Read-only.
// - Services with a record of their checklist (US-07b, migration 0007) show every task on it at the end of the
//   service, where it was then, checked or not ("X of Y done"), and the tasks removed during the service.
// - Older services have no record: they show the tasks still checked at the end, from the check-off snapshots
//   (task text, department and section at check-off time; US-06, US-13).
// Either way, later edits, moves and hides never change what a past service shows.

const PAGE = 200;

/** A record that started more than a minute after its service was created started partway through. */
const PARTIAL_AFTER_SECONDS = 60;

const IN_RECORD = "SELECT task_id FROM service_tasks st WHERE st.service_id = s.id AND st.removed_at IS NULL";
const SUMMARY_COLUMNS = `s.id, s.service_date, s.list_id, l.name AS list_name, l.deleted_at IS NOT NULL AS list_hidden,
  s.tasks_recorded_from,
  (julianday(s.tasks_recorded_from) - julianday(s.created_at)) * 86400 > ${PARTIAL_AFTER_SECONDS} AS record_partial,
  (SELECT COUNT(*) FROM checkoffs k WHERE k.service_id = s.id AND ${ACTIVE}
      AND (s.tasks_recorded_from IS NULL OR k.task_id IN (${IN_RECORD}))) AS checked_count,
  CASE WHEN s.tasks_recorded_from IS NOT NULL THEN (SELECT COUNT(*) FROM (${IN_RECORD})) END AS total_count,
  (SELECT COUNT(*) FROM resets r WHERE r.service_id = s.id) AS reset_count`;

interface SummaryRow {
  id: number;
  service_date: string;
  list_id: number;
  list_name: string;
  list_hidden: number;
  tasks_recorded_from: string | null;
  record_partial: number | null;
  checked_count: number;
  total_count: number | null;
  reset_count: number;
}

const toSummary = (r: SummaryRow): ServiceSummary => ({
  id: r.id,
  date: r.service_date,
  list: { id: r.list_id, name: r.list_name, hidden: r.list_hidden === 1 },
  checkedCount: r.checked_count,
  totalCount: r.total_count,
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

interface RecordRow {
  task_id: number;
  text: string;
  category_id: number;
  category_name: string;
  section_id: number;
  section_name: string;
  removed_at: string | null;
  checked_by_name: string | null;
  checked_at: string | null;
  task_text_snapshot: string | null;
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
  in_record: number;
}

interface ResetRow {
  id: number;
  reset_at: string;
  reset_by_name: string;
  archived_count: number;
  undone_at: string | null;
  undone_by_name: string | null;
}

/** Adds a task under its department and section, creating them in arrival order (rows come in display order). */
function place(categories: HistoryCategory[], c: { id: number; name: string }, s: { id: number; name: string }, task: HistoryTask) {
  let category = categories.find((x) => x.id === c.id);
  if (!category) {
    category = { ...c, sections: [] };
    categories.push(category);
  }
  let section = category.sections.find((x) => x.id === s.id);
  if (!section) {
    section = { ...s, tasks: [] };
    category.sections.push(section);
  }
  section.tasks.push(task);
  return { category, section };
}

/**
 * One service's history: its checklist (from the record, or from the check-off snapshots for services without
 * one), the tasks removed during it, and its resets. Null if there's no such service.
 */
export async function getServiceRecord(db: D1Database, serviceId: number, now: Date): Promise<ServiceHistoryResponse | null> {
  const [serviceResult, recordResult, checkoffResult, resetResult] = await db.batch([
    db.prepare(`SELECT ${SUMMARY_COLUMNS} FROM services s JOIN task_lists l ON l.id = s.list_id WHERE s.id = ?`).bind(serviceId),
    // The record, each task with its active check-off (if any), in its end-of-service order.
    db
      .prepare(
        `SELECT st.task_id, st.text, st.category_id, st.category_name, st.section_id, st.section_name, st.removed_at,
                k.checked_by_name, k.checked_at, k.task_text_snapshot
           FROM service_tasks st
           LEFT JOIN checkoffs k ON k.service_id = st.service_id AND k.task_id = st.task_id
                AND k.unchecked_at IS NULL AND k.reset_id IS NULL
          WHERE st.service_id = ?
          ORDER BY st.category_order, st.category_id, st.section_order, st.section_id, st.task_order, st.task_id`,
      )
      .bind(serviceId),
    // Active check-offs, placed by their snapshots (departments and sections in their current order).
    db
      .prepare(
        `SELECT k.task_id, k.task_text_snapshot, k.category_id_snapshot, k.category_name_snapshot,
                k.section_id_snapshot, k.section_name_snapshot, k.checked_by_name, k.checked_at,
                EXISTS (SELECT 1 FROM service_tasks st WHERE st.service_id = k.service_id AND st.task_id = k.task_id) AS in_record
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
  const hasRecord = row.tasks_recorded_from !== null;

  const categories: HistoryCategory[] = [];
  const removed: RemovedTask[] = [];
  const newest = new Map<object, string>();
  const checkoffOf = (k: CheckoffRow): HistoryCheckoff => ({ by: k.checked_by_name, at: k.checked_at, text: k.task_text_snapshot });

  if (hasRecord) {
    for (const r of recordResult.results as RecordRow[]) {
      // The LEFT JOIN matched (checked_at set), so the check-off's other NOT NULL columns are set too.
      const checkoff =
        r.checked_at === null ? null : { by: r.checked_by_name as string, at: r.checked_at, text: r.task_text_snapshot as string };
      const task: HistoryTask = { taskId: r.task_id, text: r.text, checkoff };
      if (r.removed_at === null) place(categories, { id: r.category_id, name: r.category_name }, { id: r.section_id, name: r.section_name }, task);
      else removed.push({ ...task, department: r.category_name, section: r.section_name, removedAt: r.removed_at });
    }
  }
  for (const k of checkoffResult.results as CheckoffRow[]) {
    const task: HistoryTask = { taskId: k.task_id, text: k.task_text_snapshot, checkoff: checkoffOf(k) };
    if (!hasRecord) {
      // Grouped by ID; a department or section renamed during the service shows the name of its newest check-off.
      const { category, section } = place(
        categories,
        { id: k.category_id_snapshot, name: k.category_name_snapshot },
        { id: k.section_id_snapshot, name: k.section_name_snapshot },
        task,
      );
      for (const [group, name] of [
        [category, k.category_name_snapshot],
        [section, k.section_name_snapshot],
      ] as const) {
        if ((newest.get(group) ?? "") < k.checked_at) {
          newest.set(group, k.checked_at);
          group.name = name;
        }
      }
    } else if (k.in_record === 0) {
      // Checked, then hidden before the record started (only in a record that started partway through).
      removed.push({ ...task, department: k.category_name_snapshot, section: k.section_name_snapshot, removedAt: null });
    }
  }

  return {
    service: {
      ...toSummary(row),
      timeZone,
      isCurrent: row.service_date === date,
      record: row.tasks_recorded_from === null ? null : { from: row.tasks_recorded_from, partial: row.record_partial === 1 },
    },
    categories,
    removed,
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
