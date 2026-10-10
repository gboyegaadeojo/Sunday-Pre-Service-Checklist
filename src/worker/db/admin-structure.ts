// Admin edits to a list's structure (US-12, US-12a, US-13). Nothing here erases a row: hiding sets
// deleted_at, so past services keep their records (check-offs snapshot text, department and section).
// Every write first requires the item and all its parents (up to the list) to be live.

import type { AdminListResponse, HiddenItem, HiddenItemsResponse, StructureKind } from "../../shared/types";
import { getSettings } from "./settings";
import { type StructureRow, buildStructure, structureStatement } from "./structure";

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

// IDs of live items whose whole ancestry is live. Used as "id IN (…)" guards.
const LIVE_LISTS = "SELECT id FROM task_lists WHERE deleted_at IS NULL";
const LIVE_CATEGORIES = `SELECT id FROM categories WHERE deleted_at IS NULL AND list_id IN (${LIVE_LISTS})`;
const LIVE_SECTIONS = `SELECT id FROM sections WHERE deleted_at IS NULL AND category_id IN (${LIVE_CATEGORIES})`;
const LIVE_TASKS = `SELECT id FROM tasks WHERE deleted_at IS NULL AND section_id IN (${LIVE_SECTIONS})`;

/** A live list by ID, or the default list. */
const findList = (db: D1Database, listRef: number | "default") =>
  db
    .prepare(
      listRef === "default"
        ? "SELECT id, name, description, is_default FROM task_lists WHERE is_default = 1 AND deleted_at IS NULL"
        : "SELECT id, name, description, is_default FROM task_lists WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(...(listRef === "default" ? [] : [listRef]))
    .first<{ id: number; name: string; description: string | null; is_default: number }>();

/** A list's live structure for the editor, with each department's Planning Center link count. */
export async function getAdminList(db: D1Database, listRef: number | "default"): Promise<AdminListResponse | null> {
  const list = await findList(db, listRef);
  if (!list) return null;

  const [structure, links] = await db.batch([
    structureStatement(db, list.id),
    db
      .prepare(
        `SELECT category_id, COUNT(*) AS n FROM team_links
          WHERE category_id IN (SELECT id FROM categories WHERE list_id = ?) GROUP BY category_id`,
      )
      .bind(list.id),
  ]);
  const linkCounts = new Map((links.results as { category_id: number; n: number }[]).map((r) => [r.category_id, r.n]));

  return {
    list: { id: list.id, name: list.name, description: list.description, isDefault: list.is_default === 1 },
    categories: buildStructure(structure.results as StructureRow[], (id, text) => ({ id, text })).map((c) => ({
      ...c,
      linkCount: linkCounts.get(c.id) ?? 0,
    })),
  };
}

/** Adds an item at the end of its parent. Returns the new ID, or null if the parent isn't live. */
async function insertLast(db: D1Database, sql: string, parentId: number, value: string): Promise<number | null> {
  const result = await db.prepare(sql).bind(parentId, value).run();
  return result.meta.changes > 0 ? result.meta.last_row_id : null;
}

export const addCategory = (db: D1Database, listId: number, name: string) =>
  insertLast(
    db,
    `INSERT INTO categories (list_id, name, sort_order)
     SELECT ?1, ?2, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories WHERE list_id = ?1)
      WHERE ?1 IN (${LIVE_LISTS})`,
    listId,
    name,
  );

export const addSection = (db: D1Database, categoryId: number, name: string) =>
  insertLast(
    db,
    `INSERT INTO sections (category_id, name, sort_order)
     SELECT ?1, ?2, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM sections WHERE category_id = ?1)
      WHERE ?1 IN (${LIVE_CATEGORIES})`,
    categoryId,
    name,
  );

export const addTask = (db: D1Database, sectionId: number, text: string) =>
  insertLast(
    db,
    `INSERT INTO tasks (section_id, text, sort_order)
     SELECT ?1, ?2, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM tasks WHERE section_id = ?1)
      WHERE ?1 IN (${LIVE_SECTIONS})`,
    sectionId,
    text,
  );

/** Renames/edits a live item. Returns false if it isn't live. */
async function update(db: D1Database, sql: string, id: number, value: string): Promise<boolean> {
  return (await db.prepare(sql).bind(value, id).run()).meta.changes > 0;
}

// Editing a task's text keeps its check-offs linked; their task_text_snapshot keeps the old text (US-13).
export const renameCategory = (db: D1Database, id: number, name: string) =>
  update(db, `UPDATE categories SET name = ?1 WHERE id = ?2 AND id IN (${LIVE_CATEGORIES})`, id, name);
export const renameSection = (db: D1Database, id: number, name: string) =>
  update(db, `UPDATE sections SET name = ?1 WHERE id = ?2 AND id IN (${LIVE_SECTIONS})`, id, name);
export const editTask = (db: D1Database, id: number, text: string) =>
  update(db, `UPDATE tasks SET text = ?1 WHERE id = ?2 AND id IN (${LIVE_TASKS})`, id, text);

/**
 * Hides a department (US-12): it and everything in it disappear from current and future checklists,
 * but stay in the database. Its Planning Center links are removed (the UI warns first).
 */
export async function hideCategory(db: D1Database, id: number): Promise<boolean> {
  const [hidden] = await db.batch([
    db.prepare(`UPDATE categories SET deleted_at = ${NOW} WHERE id = ?1 AND id IN (${LIVE_CATEGORIES})`).bind(id),
    // Only if the UPDATE above hid it (changes() is its row count, same transaction).
    db.prepare("DELETE FROM team_links WHERE category_id = ?1 AND changes() > 0").bind(id),
  ]);
  return hidden.meta.changes > 0;
}

export const hideSection = async (db: D1Database, id: number) =>
  (await db.prepare(`UPDATE sections SET deleted_at = ${NOW} WHERE id = ? AND id IN (${LIVE_SECTIONS})`).bind(id).run()).meta
    .changes > 0;

export const hideTask = async (db: D1Database, id: number) =>
  (await db.prepare(`UPDATE tasks SET deleted_at = ${NOW} WHERE id = ? AND id IN (${LIVE_TASKS})`).bind(id).run()).meta.changes >
  0;

// Restructuring and restore, Stage 5b (US-12, US-12a, US-13, US-13a) ------------------------------

const TABLE: Record<StructureKind, string> = { category: "categories", section: "sections", task: "tasks" };
const PARENT: Record<StructureKind, string> = { category: "list_id", section: "category_id", task: "section_id" };
const LIVE: Record<StructureKind, string> = { category: LIVE_CATEGORIES, section: LIVE_SECTIONS, task: LIVE_TASKS };
/** Live parents (with their whole ancestry) for each kind. */
const LIVE_PARENTS: Record<StructureKind, string> = { category: LIVE_LISTS, section: LIVE_CATEGORIES, task: LIVE_SECTIONS };

export type ReorderResult = "ok" | "not_found" | "edge" | "conflict";

/**
 * Swaps a live item with the nearest live sibling above or below it. Hidden siblings are skipped and keep
 * their sort_order, so a restored item returns near its old neighbours (build plan §3, Restore).
 */
export async function reorder(db: D1Database, kind: StructureKind, id: number, direction: "up" | "down"): Promise<ReorderResult> {
  const table = TABLE[kind];
  const parent = PARENT[kind];
  const item = await db
    .prepare(`SELECT ${parent} AS parent_id, sort_order FROM ${table} WHERE id = ? AND id IN (${LIVE[kind]})`)
    .bind(id)
    .first<{ parent_id: number; sort_order: number }>();
  if (!item) return "not_found";

  const [cmp, dir] = direction === "up" ? ["<", "DESC"] : [">", "ASC"];
  const neighbour = await db
    .prepare(
      `SELECT id, sort_order FROM ${table}
        WHERE ${parent} = ?1 AND deleted_at IS NULL AND (sort_order ${cmp} ?2 OR (sort_order = ?2 AND id ${cmp} ?3))
        ORDER BY sort_order ${dir}, id ${dir} LIMIT 1`,
    )
    .bind(item.parent_id, item.sort_order, id)
    .first<{ id: number; sort_order: number }>();
  if (!neighbour) return "edge";

  // Swap in one transaction, only if both are still where we read them (another admin may be editing too).
  // The second UPDATE runs only if the first changed its row (changes() is the previous statement's count).
  const still = (ref: string, order: string) =>
    `SELECT 1 FROM ${table} WHERE id = ${ref} AND sort_order = ${order} AND ${parent} = ?5 AND deleted_at IS NULL`;
  const [, second] = await db.batch([
    db
      .prepare(`UPDATE ${table} SET sort_order = ?4 WHERE id = ?1 AND EXISTS (${still("?1", "?3")}) AND EXISTS (${still("?2", "?4")})`)
      .bind(id, neighbour.id, item.sort_order, neighbour.sort_order, item.parent_id),
    db
      .prepare(`UPDATE ${table} SET sort_order = ?2 WHERE id = ?1 AND ${parent} = ?3 AND deleted_at IS NULL AND changes() = 1`)
      .bind(neighbour.id, item.sort_order, item.parent_id),
  ]);
  return second.meta.changes === 1 ? "ok" : "conflict";
}

export type MoveResult = "ok" | "not_found" | "same_place";

/** The list a section or category belongs to, as SQL. */
const listOfSection = (sectionId: string) =>
  `(SELECT list_id FROM categories WHERE id = (SELECT category_id FROM sections WHERE id = ${sectionId}))`;
const listOfCategory = (categoryId: string) => `(SELECT list_id FROM categories WHERE id = ${categoryId})`;

/**
 * Moves a task to the end of another live section in the same list, in any department (US-13). Its
 * check-offs stay linked by task_id; their snapshots keep where it was when checked.
 */
export async function moveTask(db: D1Database, id: number, sectionId: number): Promise<MoveResult> {
  const current = await db
    .prepare(`SELECT section_id FROM tasks WHERE id = ? AND id IN (${LIVE_TASKS})`)
    .bind(id)
    .first<{ section_id: number }>();
  if (!current) return "not_found";
  if (current.section_id === sectionId) return "same_place";
  const moved = await db
    .prepare(
      `UPDATE tasks SET section_id = ?2, sort_order = (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM tasks WHERE section_id = ?2)
        WHERE id = ?1 AND section_id = ?3 AND deleted_at IS NULL
          AND ?2 IN (${LIVE_SECTIONS}) AND ${listOfSection("?2")} = ${listOfSection("?3")}`,
    )
    .bind(id, sectionId, current.section_id)
    .run();
  return moved.meta.changes > 0 ? "ok" : "not_found";
}

/** Moves a section, with all its tasks, to the end of another live department in the same list (US-12a). */
export async function moveSection(db: D1Database, id: number, categoryId: number): Promise<MoveResult> {
  const current = await db
    .prepare(`SELECT category_id FROM sections WHERE id = ? AND id IN (${LIVE_SECTIONS})`)
    .bind(id)
    .first<{ category_id: number }>();
  if (!current) return "not_found";
  if (current.category_id === categoryId) return "same_place";
  const moved = await db
    .prepare(
      `UPDATE sections SET category_id = ?2, sort_order = (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM sections WHERE category_id = ?2)
        WHERE id = ?1 AND category_id = ?3 AND deleted_at IS NULL
          AND ?2 IN (${LIVE_CATEGORIES}) AND ${listOfCategory("?2")} = ${listOfCategory("?3")}`,
    )
    .bind(id, categoryId, current.category_id)
    .run();
  return moved.meta.changes > 0 ? "ok" : "not_found";
}

export type RestoreResult = "ok" | "not_found" | "parent_hidden";

// SQL for an item's ancestors and list, given its ID as ?1. Ancestors are listed outermost first.
const SECTION_OF_TASK = "(SELECT section_id FROM tasks WHERE id = ?1)";
const ANCESTORS: Record<StructureKind, { kind: StructureKind; id: string }[]> = {
  category: [],
  section: [{ kind: "category", id: "(SELECT category_id FROM sections WHERE id = ?1)" }],
  task: [
    { kind: "category", id: `(SELECT category_id FROM sections WHERE id = ${SECTION_OF_TASK})` },
    { kind: "section", id: SECTION_OF_TASK },
  ],
};
const LIST_OF: Record<StructureKind, string> = {
  category: listOfCategory("?1"),
  section: listOfSection("?1"),
  task: listOfSection(SECTION_OF_TASK),
};

/**
 * Brings a hidden item back (US-13a). It keeps its ID, so its check-offs stay attached, and its sort_order,
 * so it returns to its old place. It's only restored into a live parent: withParents first restores the
 * hidden department/section it sits in, all in one transaction.
 */
export async function restore(db: D1Database, kind: StructureKind, id: number, withParents: boolean): Promise<RestoreResult> {
  const table = TABLE[kind];
  const itemHidden = `EXISTS (SELECT 1 FROM ${table} WHERE id = ?1 AND deleted_at IS NOT NULL)`;
  const listLive = `${LIST_OF[kind]} IN (${LIVE_LISTS})`;
  const parents = withParents
    ? ANCESTORS[kind].map((a) =>
        db
          .prepare(`UPDATE ${TABLE[a.kind]} SET deleted_at = NULL WHERE id = ${a.id} AND deleted_at IS NOT NULL AND ${itemHidden} AND ${listLive}`)
          .bind(id),
      )
    : [];
  const results = await db.batch([
    ...parents,
    db
      .prepare(`UPDATE ${table} SET deleted_at = NULL WHERE id = ?1 AND deleted_at IS NOT NULL AND ${PARENT[kind]} IN (${LIVE_PARENTS[kind]})`)
      .bind(id),
  ]);
  if ((results.at(-1)?.meta.changes ?? 0) > 0) return "ok";
  // Not restored: either it sits in a hidden parent, or it isn't hidden (or doesn't exist) anymore.
  const stillHidden = await db.prepare(`SELECT 1 FROM ${table} WHERE id = ?1 AND deleted_at IS NOT NULL AND ${listLive}`).bind(id).first();
  return stillHidden ? "parent_hidden" : "not_found";
}

interface HiddenRow {
  id: number;
  name: string;
  hidden_at: string;
  category_id?: number;
  category_name?: string;
  category_hidden?: number;
  section_id?: number;
  section_name?: string;
  section_hidden?: number;
  section_count?: number;
  task_count?: number;
}

/** Every item in a list hidden on its own (US-13a), newest first, with where it sits. */
export async function getHiddenItems(db: D1Database, listRef: number | "default"): Promise<HiddenItemsResponse | null> {
  const list = await findList(db, listRef);
  if (!list) return null;
  const { time_zone: timeZone } = await getSettings(db, ["time_zone"]);
  if (!timeZone) throw new Error("The time_zone setting is missing.");

  const [categories, sections, tasks] = await db.batch([
    db
      .prepare(
        `SELECT c.id, c.name, c.deleted_at AS hidden_at,
                (SELECT COUNT(*) FROM sections s WHERE s.category_id = c.id AND s.deleted_at IS NULL) AS section_count,
                (SELECT COUNT(*) FROM tasks t JOIN sections s ON s.id = t.section_id
                  WHERE s.category_id = c.id AND s.deleted_at IS NULL AND t.deleted_at IS NULL) AS task_count
           FROM categories c WHERE c.list_id = ?1 AND c.deleted_at IS NOT NULL`,
      )
      .bind(list.id),
    db
      .prepare(
        `SELECT s.id, s.name, s.deleted_at AS hidden_at,
                c.id AS category_id, c.name AS category_name, c.deleted_at IS NOT NULL AS category_hidden,
                (SELECT COUNT(*) FROM tasks t WHERE t.section_id = s.id AND t.deleted_at IS NULL) AS task_count
           FROM sections s JOIN categories c ON c.id = s.category_id
          WHERE c.list_id = ?1 AND s.deleted_at IS NOT NULL`,
      )
      .bind(list.id),
    db
      .prepare(
        `SELECT t.id, t.text AS name, t.deleted_at AS hidden_at,
                s.id AS section_id, s.name AS section_name, s.deleted_at IS NOT NULL AS section_hidden,
                c.id AS category_id, c.name AS category_name, c.deleted_at IS NOT NULL AS category_hidden
           FROM tasks t JOIN sections s ON s.id = t.section_id JOIN categories c ON c.id = s.category_id
          WHERE c.list_id = ?1 AND t.deleted_at IS NOT NULL`,
      )
      .bind(list.id),
  ]);

  const parent = (id?: number, name?: string, hidden?: number) =>
    id === undefined ? undefined : { id, name: name as string, hidden: hidden === 1 };
  const toItem =
    (kind: StructureKind) =>
    (r: HiddenRow): HiddenItem => ({
      kind,
      id: r.id,
      name: r.name,
      hiddenAt: r.hidden_at,
      category: parent(r.category_id, r.category_name, r.category_hidden),
      section: parent(r.section_id, r.section_name, r.section_hidden),
      sectionCount: r.section_count,
      taskCount: r.task_count,
    });
  const items = [
    ...(categories.results as HiddenRow[]).map(toItem("category")),
    ...(sections.results as HiddenRow[]).map(toItem("section")),
    ...(tasks.results as HiddenRow[]).map(toItem("task")),
  ].sort((a, b) => b.hiddenAt.localeCompare(a.hiddenAt) || b.id - a.id);

  return { list: { id: list.id, name: list.name }, timeZone, items };
}
