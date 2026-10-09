// Admin edits to a list's structure (US-12, US-12a, US-13). Nothing here erases a row: hiding sets
// deleted_at, so past services keep their records (check-offs snapshot text, department and section).
// Every write first requires the item and all its parents (up to the list) to be live.

import type { AdminListResponse } from "../../shared/types";
import { type StructureRow, buildStructure, structureStatement } from "./structure";

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

// IDs of live items whose whole ancestry is live. Used as "id IN (…)" guards.
const LIVE_LISTS = "SELECT id FROM task_lists WHERE deleted_at IS NULL";
const LIVE_CATEGORIES = `SELECT id FROM categories WHERE deleted_at IS NULL AND list_id IN (${LIVE_LISTS})`;
const LIVE_SECTIONS = `SELECT id FROM sections WHERE deleted_at IS NULL AND category_id IN (${LIVE_CATEGORIES})`;
const LIVE_TASKS = `SELECT id FROM tasks WHERE deleted_at IS NULL AND section_id IN (${LIVE_SECTIONS})`;

/** A list's live structure for the editor, with each department's Planning Center link count. */
export async function getAdminList(db: D1Database, listRef: number | "default"): Promise<AdminListResponse | null> {
  const list = await db
    .prepare(
      listRef === "default"
        ? "SELECT id, name, description, is_default FROM task_lists WHERE is_default = 1 AND deleted_at IS NULL"
        : "SELECT id, name, description, is_default FROM task_lists WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(...(listRef === "default" ? [] : [listRef]))
    .first<{ id: number; name: string; description: string | null; is_default: number }>();
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
