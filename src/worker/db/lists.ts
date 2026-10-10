// Task lists (US-11, build plan 5d.1): create (empty or as a copy), rename/describe, set the default, hide
// and restore. Lists are never erased: hiding sets deleted_at, and past services keep the list they used.
// Every applied change is logged to checklist_events (entity 'list') in the same transaction, log row
// first, as in admin-structure.ts.

import type { AdminListSummary, ListsResponse } from "../../shared/types";
import { NOW, bindWithActor } from "./admin-structure";
import type { Actor } from "./checkoffs";
import { getCalendarSettings, getCurrentService } from "./services";

/** INSERT … SELECT of one log row for the list matched by `where` (alias l). Actor binds as ?21–?25. */
const logListSql = (action: string, o: { where: string; before?: string; after?: string }) =>
  `INSERT INTO checklist_events
     (list_id, entity, entity_id, entity_name, action, before_json, after_json, user_id, user_name, session_id, tab_id, user_agent)
   SELECT l.id, 'list', l.id, l.name, '${action}', ${o.before ?? "NULL"}, ${o.after ?? "NULL"}, ?21, ?22, ?23, ?24, ?25
     FROM task_lists l WHERE ${o.where}`;

/**
 * List names are unique among visible lists, ignoring capitalization and extra spaces (US-11). Names are
 * stored with spaces collapsed, so comparing lower(name) is enough. SQL condition: no visible list other
 * than `self` (an SQL expression, or NULL) is called `name` (an SQL expression).
 */
const NAME_FREE = (name: string, self: string) =>
  `NOT EXISTS (SELECT 1 FROM task_lists o WHERE o.deleted_at IS NULL AND o.id IS NOT ${self} AND lower(o.name) = lower(${name}))`;

/** Trims a list name and collapses runs of spaces, the form it's stored and compared in. */
export const normalizeListName = (name: string) => name.trim().replace(/\s+/g, " ");

/** The visible list (other than exceptId) whose name matches, ignoring case and spaces, or null. */
async function takenBy(db: D1Database, name: string, exceptId: number | null): Promise<string | null> {
  const { results } = await db
    .prepare("SELECT name FROM task_lists WHERE deleted_at IS NULL AND id IS NOT ?")
    .bind(exceptId)
    .all<{ name: string }>();
  const key = normalizeListName(name).toLowerCase();
  return results.find((r) => normalizeListName(r.name).toLowerCase() === key)?.name ?? null;
}

/** {"id", "name"} of the live default list, as JSON (or NULL). */
const DEFAULT_LIST_JSON = "json((SELECT json_object('id', id, 'name', name) FROM task_lists WHERE is_default = 1 AND deleted_at IS NULL))";

interface ListRow {
  id: number;
  name: string;
  description: string | null;
  is_default: number;
  created_at: string;
  deleted_at: string | null;
  department_count: number;
  task_count: number;
}

/** All lists (live first: the default, then by name; then hidden ones) and the current service's list. */
export async function getLists(db: D1Database, now: Date): Promise<ListsResponse> {
  const { timeZone } = await getCalendarSettings(db);
  const service = await getCurrentService(db, now);
  const [lists, checkoffs] = await db.batch([
    db.prepare(
      `SELECT l.id, l.name, l.description, l.is_default, l.created_at, l.deleted_at,
              (SELECT COUNT(*) FROM categories c WHERE c.list_id = l.id AND c.deleted_at IS NULL) AS department_count,
              (SELECT COUNT(*) FROM tasks t JOIN sections s ON s.id = t.section_id JOIN categories c ON c.id = s.category_id
                WHERE c.list_id = l.id AND c.deleted_at IS NULL AND s.deleted_at IS NULL AND t.deleted_at IS NULL) AS task_count
         FROM task_lists l
        ORDER BY l.deleted_at IS NOT NULL, l.is_default DESC, l.name COLLATE NOCASE, l.id`,
    ),
    db.prepare("SELECT EXISTS (SELECT 1 FROM checkoffs WHERE service_id = ?) AS any").bind(service?.id ?? null),
  ]);
  return {
    lists: (lists.results as ListRow[]).map(
      (r): AdminListSummary => ({
        id: r.id,
        name: r.name,
        description: r.description,
        isDefault: r.is_default === 1,
        departmentCount: r.department_count,
        taskCount: r.task_count,
        createdAt: r.created_at,
        hiddenAt: r.deleted_at,
      }),
    ),
    currentService: service
      ? {
          id: service.id,
          date: service.date,
          listId: service.listId,
          hasCheckoffs: (checkoffs.results[0] as { any: number }).any === 1,
        }
      : null,
    timeZone,
  };
}

export type CreateListResult = { ok: true; id: number } | { ok: false; reason: "not_found" } | { ok: false; reason: "name_taken"; existing: string };

/**
 * Creates a list, empty or as a copy of a live list's live departments, sections and tasks (in order, with
 * new IDs; hidden items and Planning Center links are not copied). The copy is three set-based INSERTs, so
 * it stays within D1's per-request query limit whatever the list's size. Refused if the list to copy
 * isn't live, or a visible list already has the name.
 */
export async function createList(
  db: D1Database,
  actor: Actor,
  { name, description, copyFrom }: { name: string; description: string | null; copyFrom: number | null },
): Promise<CreateListResult> {
  if (copyFrom !== null) {
    const source = await db.prepare("SELECT 1 FROM task_lists WHERE id = ? AND deleted_at IS NULL").bind(copyFrom).first();
    if (!source) return { ok: false, reason: "not_found" };
  }
  const existing = await takenBy(db, name, null);
  if (existing !== null) return { ok: false, reason: "name_taken", existing };
  // The new list's ID is fixed up front so every statement below can refer to it. If another admin takes
  // it first, the INSERT fails, the whole batch rolls back, and we try once more.
  for (let attempt = 0; ; attempt++) {
    const next = await db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM task_lists").first<{ id: number }>();
    const id = next?.id as number;
    const copy =
      copyFrom === null
        ? []
        : [
            db
              .prepare(
                `INSERT INTO categories (list_id, name, sort_order)
                 SELECT ?1, name, sort_order FROM categories WHERE list_id = ?2 AND deleted_at IS NULL AND EXISTS (SELECT 1 FROM task_lists WHERE id = ?1)`,
              )
              .bind(id, copyFrom),
            // sort_order is distinct within a parent, so it pairs each copied parent with its original.
            db
              .prepare(
                `INSERT INTO sections (category_id, name, sort_order)
                 SELECT nc.id, s.name, s.sort_order
                   FROM sections s
                   JOIN categories oc ON oc.id = s.category_id
                   JOIN categories nc ON nc.list_id = ?1 AND nc.sort_order = oc.sort_order
                  WHERE EXISTS (SELECT 1 FROM task_lists WHERE id = ?1) AND oc.list_id = ?2 AND oc.deleted_at IS NULL AND s.deleted_at IS NULL`,
              )
              .bind(id, copyFrom),
            db
              .prepare(
                `INSERT INTO tasks (section_id, text, sort_order)
                 SELECT ns.id, t.text, t.sort_order
                   FROM tasks t
                   JOIN sections os ON os.id = t.section_id
                   JOIN categories oc ON oc.id = os.category_id
                   JOIN categories nc ON nc.list_id = ?1 AND nc.sort_order = oc.sort_order
                   JOIN sections ns ON ns.category_id = nc.id AND ns.sort_order = os.sort_order
                  WHERE EXISTS (SELECT 1 FROM task_lists WHERE id = ?1) AND oc.list_id = ?2 AND oc.deleted_at IS NULL AND os.deleted_at IS NULL AND t.deleted_at IS NULL`,
              )
              .bind(id, copyFrom),
          ];
    try {
      // The name check is repeated in the INSERT, so two admins can't take the same name at once. The
      // copy statements run only if the list row went in.
      const [inserted] = await db.batch([
        db
          .prepare(`INSERT INTO task_lists (id, name, description) SELECT ?1, ?2, ?3 WHERE ${NAME_FREE("?2", "NULL")}`)
          .bind(id, name, description),
        bindWithActor(
          db.prepare(
            logListSql("add", {
              where: "l.id = ?1",
              after: `CASE WHEN ?2 IS NULL THEN NULL ELSE
                        json_object('copiedFrom', json((SELECT json_object('id', id, 'name', name) FROM task_lists WHERE id = ?2))) END`,
            }),
          ),
          actor,
          id,
          copyFrom,
        ),
        ...copy,
      ]);
      if (inserted.meta.changes === 0) return { ok: false, reason: "name_taken", existing: (await takenBy(db, name, null)) ?? name };
      return { ok: true, id };
    } catch (err) {
      if (attempt > 0 || !/UNIQUE|PRIMARY KEY/i.test(String(err))) throw err;
    }
  }
}

export type UpdateListResult = "ok" | "not_found" | { nameTakenBy: string };

/** Renames a live list and/or changes its description, logging old and new. Refused if another visible list has the name. */
export async function updateList(db: D1Database, actor: Actor, id: number, name: string, description: string | null): Promise<UpdateListResult> {
  const existing = await takenBy(db, name, id);
  if (existing !== null) return { nameTakenBy: existing };
  const [, updated] = await db.batch([
    bindWithActor(
      db.prepare(
        logListSql("rename", {
          where: `l.id = ?1 AND l.deleted_at IS NULL AND ${NAME_FREE("?2", "?1")}`,
          before: "json_object('name', l.name, 'description', l.description)",
          after: "json_object('name', ?2, 'description', ?3)",
        }),
      ),
      actor,
      id,
      name,
      description,
    ),
    db.prepare("UPDATE task_lists SET name = ?2, description = ?3 WHERE id = ?1 AND changes() = 1").bind(id, name, description),
  ]);
  if (updated.meta.changes > 0) return "ok";
  const taken = await takenBy(db, name, id);
  return taken === null ? "not_found" : { nameTakenBy: taken };
}

export type SetDefaultResult = { ok: true; serviceSwitched: boolean } | { ok: false; reason: "not_found" | "already_default" };

/**
 * Makes a live list the default for new services (US-11), in one transaction. A service keeps the list it
 * started with; with applyToServiceId, the current service switches too, but only if it has no check-offs
 * at all (so no check-off or archived reset is left pointing at the old list's tasks).
 */
export async function setDefaultList(
  db: D1Database,
  actor: Actor,
  id: number,
  applyToServiceId: number | null,
): Promise<SetDefaultResult> {
  const switchable = "?2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM checkoffs WHERE service_id = ?2)";
  const results = await db.batch([
    bindWithActor(
      db.prepare(
        logListSql("set_default", {
          where: "l.id = ?1 AND l.deleted_at IS NULL AND l.is_default = 0",
          before: `json_object('defaultList', ${DEFAULT_LIST_JSON})`,
          after: `json_object('defaultList', json_object('id', l.id, 'name', l.name),
                    'serviceDate', CASE WHEN ${switchable} THEN (SELECT service_date FROM services WHERE id = ?2) END)`,
        }),
      ),
      actor,
      id,
      applyToServiceId,
    ),
    // Clear the old default only if the change was logged (changes() is the log INSERT)…
    db.prepare("UPDATE task_lists SET is_default = 0 WHERE is_default = 1 AND id <> ?1 AND changes() = 1").bind(id),
    // …and set the new one only when no live default is left (one default at a time: partial unique index).
    db
      .prepare(
        `UPDATE task_lists SET is_default = 1
          WHERE id = ?1 AND deleted_at IS NULL AND is_default = 0
            AND NOT EXISTS (SELECT 1 FROM task_lists WHERE is_default = 1 AND deleted_at IS NULL)`,
      )
      .bind(id),
    db
      .prepare(
        `UPDATE services SET list_id = ?1
          WHERE id = ?2 AND ${switchable} AND changes() = 1`,
      )
      .bind(id, applyToServiceId),
  ]);
  if ((results[2].meta.changes ?? 0) > 0) return { ok: true, serviceSwitched: (results[3].meta.changes ?? 0) > 0 };
  const row = await db.prepare("SELECT is_default FROM task_lists WHERE id = ? AND deleted_at IS NULL").bind(id).first<{ is_default: number }>();
  return { ok: false, reason: row?.is_default === 1 ? "already_default" : "not_found" };
}

export type HideListResult = "ok" | "not_found" | "default" | "in_use";

/**
 * Hides a list (US-11): it leaves the lists page and can't be edited or copied, but stays in the database
 * so past services keep their records. The default list, and the list the current service uses, can't be
 * hidden.
 */
export async function hideList(db: D1Database, actor: Actor, id: number, currentServiceId: number | null): Promise<HideListResult> {
  const [, hidden] = await db.batch([
    bindWithActor(
      db.prepare(
        logListSql("hide", {
          where: `l.id = ?1 AND l.deleted_at IS NULL AND l.is_default = 0
                  AND NOT EXISTS (SELECT 1 FROM services WHERE id = ?2 AND list_id = ?1)`,
        }),
      ),
      actor,
      id,
      currentServiceId,
    ),
    db.prepare(`UPDATE task_lists SET deleted_at = ${NOW} WHERE id = ?1 AND changes() = 1`).bind(id),
  ]);
  if (hidden.meta.changes > 0) return "ok";
  const row = await db.prepare("SELECT is_default FROM task_lists WHERE id = ? AND deleted_at IS NULL").bind(id).first<{ is_default: number }>();
  if (!row) return "not_found";
  return row.is_default === 1 ? "default" : "in_use";
}

export type RestoreListResult = "ok" | "not_found" | { nameTakenBy: string };

/**
 * Brings a hidden list back, with everything in it that wasn't hidden on its own. Refused if it isn't hidden,
 * or a visible list now has its name (rename that one first).
 */
export async function restoreList(db: D1Database, actor: Actor, id: number): Promise<RestoreListResult> {
  const [, restored] = await db.batch([
    bindWithActor(
      db.prepare(logListSql("restore", { where: `l.id = ?1 AND l.deleted_at IS NOT NULL AND ${NAME_FREE("l.name", "?1")}` })),
      actor,
      id,
    ),
    db.prepare("UPDATE task_lists SET deleted_at = NULL WHERE id = ?1 AND changes() = 1").bind(id),
  ]);
  if (restored.meta.changes > 0) return "ok";
  const row = await db.prepare("SELECT name FROM task_lists WHERE id = ? AND deleted_at IS NOT NULL").bind(id).first<{ name: string }>();
  const taken = row ? await takenBy(db, row.name, id) : null;
  return taken === null ? "not_found" : { nameTakenBy: taken };
}
