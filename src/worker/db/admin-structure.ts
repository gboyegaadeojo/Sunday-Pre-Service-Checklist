// Admin edits to a list's structure (US-12, US-12a, US-13, US-13a). Nothing here erases a row: hiding sets
// deleted_at, so past services keep their records (check-offs snapshot text, department and section).
// Every write first requires the item and all its parents (up to the list) to be live.
//
// Every applied edit is logged to the append-only checklist_events table (US-13b), in the same db.batch
// transaction. For changes to an existing row the log row is inserted first, reading the "before" values
// in that transaction, and the change runs only if the log row was written (changes() = 1 refers to the
// previous statement in the batch). So an edit and its log entry always happen together, or not at all.

import type {
  AdminListResponse,
  ChecklistEditsResponse,
  EditAction,
  EditEntity,
  EditValues,
  HiddenItem,
  HiddenItemsResponse,
  StructureKind,
} from "../../shared/types";
import { type Actor, actorValues } from "./checkoffs";
import { getSettings } from "./settings";
import { type StructureRow, buildStructure, structureStatement } from "./structure";

export const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

// IDs of live items whose whole ancestry is live. Used as "id IN (…)" guards.
export const LIVE_LISTS = "SELECT id FROM task_lists WHERE deleted_at IS NULL";
const LIVE_CATEGORIES = `SELECT id FROM categories WHERE deleted_at IS NULL AND list_id IN (${LIVE_LISTS})`;
const LIVE_SECTIONS = `SELECT id FROM sections WHERE deleted_at IS NULL AND category_id IN (${LIVE_CATEGORIES})`;
const LIVE_TASKS = `SELECT id FROM tasks WHERE deleted_at IS NULL AND section_id IN (${LIVE_SECTIONS})`;

const TABLE: Record<StructureKind, string> = { category: "categories", section: "sections", task: "tasks" };
const PARENT: Record<StructureKind, string> = { category: "list_id", section: "category_id", task: "section_id" };
const LIVE: Record<StructureKind, string> = { category: LIVE_CATEGORIES, section: LIVE_SECTIONS, task: LIVE_TASKS };
/** Live parents (with their whole ancestry) for each kind. */
const LIVE_PARENTS: Record<StructureKind, string> = { category: LIVE_LISTS, section: LIVE_CATEGORIES, task: LIVE_SECTIONS };

// The edit log -------------------------------------------------------------------------------------

/** 1-based position of row `a` among its live siblings (counting itself even while it's hidden). */
const position = (kind: StructureKind, a: string) =>
  `1 + (SELECT COUNT(*) FROM ${TABLE[kind]} y WHERE y.${PARENT[kind]} = ${a}.${PARENT[kind]} AND y.deleted_at IS NULL
          AND y.id <> ${a}.id AND (y.sort_order < ${a}.sort_order OR (y.sort_order = ${a}.sort_order AND y.id < ${a}.id)))`;
const DEPARTMENT = "json_object('id', c.id, 'name', c.name)";

/** Per kind: the row's alias, a FROM joining it to its section/department (alias c), its label, and its place as JSON. */
const LOG_SQL: Record<StructureKind, { alias: string; from: string; name: string; place: string }> = {
  category: { alias: "c", from: "categories c", name: "c.name", place: `json_object('position', ${position("category", "c")})` },
  section: {
    alias: "s",
    from: "sections s JOIN categories c ON c.id = s.category_id",
    name: "s.name",
    place: `json_object('department', ${DEPARTMENT}, 'position', ${position("section", "s")})`,
  },
  task: {
    alias: "t",
    from: "tasks t JOIN sections s ON s.id = t.section_id JOIN categories c ON c.id = s.category_id",
    name: "t.text",
    place: `json_object('department', ${DEPARTMENT}, 'section', json_object('id', s.id, 'name', s.name), 'position', ${position("task", "t")})`,
  },
};

/**
 * INSERT … SELECT of one log row for the item matched by `where` (no row matched: nothing logged).
 * before/after are SQL expressions returning a JSON object, or NULL. The actor is bound as ?21–?25.
 */
const logSql = (kind: StructureKind, action: EditAction, o: { where: string; before?: string; after?: string; name?: string }) =>
  `INSERT INTO checklist_events
     (list_id, entity, entity_id, entity_name, action, before_json, after_json, user_id, user_name, session_id, tab_id, user_agent)
   SELECT c.list_id, '${kind}', ${LOG_SQL[kind].alias}.id, ${o.name ?? LOG_SQL[kind].name}, '${action}',
          ${o.before ?? "NULL"}, ${o.after ?? "NULL"}, ?21, ?22, ?23, ?24, ?25
     FROM ${LOG_SQL[kind].from} WHERE ${o.where}`;

/** Binds a statement's own parameters as ?1… and the actor as ?21–?25. */
export const bindWithActor = (stmt: D1PreparedStatement, actor: Actor, ...params: unknown[]) =>
  stmt.bind(...params, ...Array(20 - params.length).fill(null), ...actorValues(actor));

// Reading -----------------------------------------------------------------------------------------

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

const EDITS_PAGE = 500;

interface EditRow {
  id: number;
  created_at: string;
  action: EditAction;
  entity: EditEntity;
  list_id: number;
  list_name: string | null;
  entity_id: number;
  entity_name: string;
  before_json: string | null;
  after_json: string | null;
  user_name: string;
  session_id: string | null;
  tab_id: string | null;
}

/**
 * The latest checklist edits (US-13b) across all lists, or of one list, newest first, each with its list's
 * current name. Read-only: nothing edits or deletes log rows.
 */
export async function getEdits(db: D1Database, listId?: number): Promise<ChecklistEditsResponse> {
  const { time_zone: timeZone } = await getSettings(db, ["time_zone"]);
  if (!timeZone) throw new Error("The time_zone setting is missing.");
  const { results } = await db
    .prepare(
      `SELECT e.id, e.created_at, e.action, e.entity, e.list_id, l.name AS list_name, e.entity_id, e.entity_name,
              e.before_json, e.after_json, e.user_name, e.session_id, e.tab_id
         FROM checklist_events e LEFT JOIN task_lists l ON l.id = e.list_id
        WHERE ?1 IS NULL OR e.list_id = ?1
        ORDER BY e.id DESC LIMIT ?2`,
    )
    .bind(listId ?? null, EDITS_PAGE + 1)
    .all<EditRow>();
  const parse = (json: string | null) => (json === null ? null : (JSON.parse(json) as EditValues));
  return {
    timeZone,
    events: results.slice(0, EDITS_PAGE).map((r) => ({
      id: r.id,
      at: r.created_at,
      action: r.action,
      kind: r.entity,
      list: { id: r.list_id, name: r.list_name ?? `List #${r.list_id}` },
      itemId: r.entity_id,
      itemName: r.entity_name,
      before: parse(r.before_json),
      after: parse(r.after_json),
      user: r.user_name,
      sessionId: r.session_id,
      tabId: r.tab_id,
    })),
    truncated: results.length > EDITS_PAGE,
  };
}

// Add, rename/edit, hide (Stage 5a) -----------------------------------------------------------------

/** Adds an item at the end of its parent (?1) with name/text ?2, and logs it. Returns the new ID, or null if the parent isn't live. */
async function addItem(db: D1Database, kind: StructureKind, actor: Actor, parentId: number, value: string): Promise<number | null> {
  const column = kind === "task" ? "text" : "name";
  const [inserted] = await db.batch([
    db
      .prepare(
        `INSERT INTO ${TABLE[kind]} (${PARENT[kind]}, ${column}, sort_order)
         SELECT ?1, ?2, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM ${TABLE[kind]} WHERE ${PARENT[kind]} = ?1)
          WHERE ?1 IN (${LIVE_PARENTS[kind]})`,
      )
      .bind(parentId, value),
    bindWithActor(
      db.prepare(
        logSql(kind, "add", {
          where: `${LOG_SQL[kind].alias}.id = last_insert_rowid() AND changes() = 1`,
          after: `json_object('place', ${LOG_SQL[kind].place})`,
        }),
      ),
      actor,
    ),
  ]);
  return inserted.meta.changes > 0 ? inserted.meta.last_row_id : null;
}

export const addCategory = (db: D1Database, actor: Actor, listId: number, name: string) => addItem(db, "category", actor, listId, name);
export const addSection = (db: D1Database, actor: Actor, categoryId: number, name: string) =>
  addItem(db, "section", actor, categoryId, name);
export const addTask = (db: D1Database, actor: Actor, sectionId: number, text: string) => addItem(db, "task", actor, sectionId, text);

/** Renames a live department/section or edits a live task's text, and logs old and new. False if it isn't live. */
async function setText(db: D1Database, kind: StructureKind, actor: Actor, id: number, value: string): Promise<boolean> {
  const column = kind === "task" ? "text" : "name";
  const a = LOG_SQL[kind].alias;
  const [, updated] = await db.batch([
    bindWithActor(
      db.prepare(
        logSql(kind, kind === "task" ? "edit" : "rename", {
          where: `${a}.id = ?1 AND ${a}.id IN (${LIVE[kind]})`,
          name: "?2",
          before: `json_object('${column}', ${a}.${column})`,
          after: `json_object('${column}', ?2)`,
        }),
      ),
      actor,
      id,
      value,
    ),
    db.prepare(`UPDATE ${TABLE[kind]} SET ${column} = ?2 WHERE id = ?1 AND changes() = 1`).bind(id, value),
  ]);
  return updated.meta.changes > 0;
}

// Editing a task's text keeps its check-offs linked; their task_text_snapshot keeps the old text (US-13).
export const renameCategory = (db: D1Database, actor: Actor, id: number, name: string) => setText(db, "category", actor, id, name);
export const renameSection = (db: D1Database, actor: Actor, id: number, name: string) => setText(db, "section", actor, id, name);
export const editTask = (db: D1Database, actor: Actor, id: number, text: string) => setText(db, "task", actor, id, text);

/**
 * Hides a live item: it and everything in it disappear from current and future checklists, but stay in the
 * database. Hiding a department also removes its Planning Center links (US-12; the UI warns first), and the
 * log records which ones, so they can be linked again.
 */
async function hideItem(db: D1Database, kind: StructureKind, actor: Actor, id: number): Promise<boolean> {
  const a = LOG_SQL[kind].alias;
  const removedLinks =
    "(SELECT json_group_array(team_name || COALESCE(' › ' || position_name, '')) FROM team_links WHERE category_id = c.id)";
  const statements = [
    bindWithActor(
      db.prepare(
        logSql(kind, "hide", {
          where: `${a}.id = ?1 AND ${a}.id IN (${LIVE[kind]})`,
          before:
            kind === "category"
              ? `CASE WHEN EXISTS (SELECT 1 FROM team_links WHERE category_id = c.id) THEN json_object('teamLinks', json(${removedLinks})) END`
              : undefined,
        }),
      ),
      actor,
      id,
    ),
    db.prepare(`UPDATE ${TABLE[kind]} SET deleted_at = ${NOW} WHERE id = ?1 AND changes() = 1`).bind(id),
  ];
  // Only if the UPDATE above hid it (changes() is its row count, same transaction).
  if (kind === "category") statements.push(db.prepare("DELETE FROM team_links WHERE category_id = ?1 AND changes() > 0").bind(id));
  const [, hidden] = await db.batch(statements);
  return hidden.meta.changes > 0;
}

export const hideCategory = (db: D1Database, actor: Actor, id: number) => hideItem(db, "category", actor, id);
export const hideSection = (db: D1Database, actor: Actor, id: number) => hideItem(db, "section", actor, id);
export const hideTask = (db: D1Database, actor: Actor, id: number) => hideItem(db, "task", actor, id);

// Restructuring and restore, Stage 5b (US-12, US-12a, US-13, US-13a) ------------------------------

export type ReorderResult = "ok" | "not_found" | "edge" | "conflict";

/**
 * Swaps a live item with the nearest live sibling above or below it. Hidden siblings are skipped and keep
 * their sort_order, so a restored item returns near its old neighbours (build plan §3, Restore).
 */
export async function reorder(
  db: D1Database,
  actor: Actor,
  kind: StructureKind,
  id: number,
  direction: "up" | "down",
): Promise<ReorderResult> {
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
  // The log row carries that check; each UPDATE runs only if the statement before it changed one row.
  const still = (ref: string, order: string) =>
    `EXISTS (SELECT 1 FROM ${table} WHERE id = ${ref} AND sort_order = ${order} AND ${parent} = ?5 AND deleted_at IS NULL)`;
  const { alias: a, place } = LOG_SQL[kind];
  const [, , second] = await db.batch([
    bindWithActor(
      db.prepare(
        logSql(kind, "reorder", {
          where: `${a}.id = ?1 AND ${still("?1", "?3")} AND ${still("?2", "?4")}`,
          before: `json_object('place', ${place})`,
          after: `json_object('place', json_set(${place}, '$.position', ${position(kind, a)} + ?6))`,
        }),
      ),
      actor,
      id,
      neighbour.id,
      item.sort_order,
      neighbour.sort_order,
      item.parent_id,
      direction === "up" ? -1 : 1,
    ),
    db.prepare(`UPDATE ${table} SET sort_order = ?2 WHERE id = ?1 AND changes() = 1`).bind(id, neighbour.sort_order),
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
 * Moves a live task or section (?1) from its current parent (?3) to the end of another live parent (?2) in
 * the same list, and logs where it was and where it went.
 */
async function moveItem(db: D1Database, actor: Actor, kind: "task" | "section", id: number, to: number): Promise<MoveResult> {
  const table = TABLE[kind];
  const parent = PARENT[kind];
  const current = await db
    .prepare(`SELECT ${parent} AS parent_id FROM ${table} WHERE id = ? AND id IN (${LIVE[kind]})`)
    .bind(id)
    .first<{ parent_id: number }>();
  if (!current) return "not_found";
  if (current.parent_id === to) return "same_place";

  const sameList = kind === "task" ? `${listOfSection("?2")} = ${listOfSection("?3")}` : `${listOfCategory("?2")} = ${listOfCategory("?3")}`;
  // Where it will be: the destination's names, at the end of its live items.
  const destination =
    kind === "task"
      ? `(SELECT json_object('department', json_object('id', dc.id, 'name', dc.name), 'section', json_object('id', ds.id, 'name', ds.name),
                 'position', 1 + (SELECT COUNT(*) FROM tasks y WHERE y.section_id = ds.id AND y.deleted_at IS NULL))
            FROM sections ds JOIN categories dc ON dc.id = ds.category_id WHERE ds.id = ?2)`
      : `(SELECT json_object('department', json_object('id', dc.id, 'name', dc.name),
                 'position', 1 + (SELECT COUNT(*) FROM sections y WHERE y.category_id = dc.id AND y.deleted_at IS NULL))
            FROM categories dc WHERE dc.id = ?2)`;
  const { alias: a, place } = LOG_SQL[kind];
  const [, moved] = await db.batch([
    bindWithActor(
      db.prepare(
        logSql(kind, "move", {
          where: `${a}.id = ?1 AND ${a}.${parent} = ?3 AND ${a}.deleted_at IS NULL AND ?2 IN (${LIVE_PARENTS[kind]}) AND ${sameList}`,
          before: `json_object('place', ${place})`,
          after: `json_object('place', json(${destination}))`,
        }),
      ),
      actor,
      id,
      to,
      current.parent_id,
    ),
    db
      .prepare(
        `UPDATE ${table} SET ${parent} = ?2, sort_order = (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM ${table} WHERE ${parent} = ?2)
          WHERE id = ?1 AND changes() = 1`,
      )
      .bind(id, to),
  ]);
  return moved.meta.changes > 0 ? "ok" : "not_found";
}

/**
 * Moves a task to the end of another live section in the same list, in any department (US-13). Its
 * check-offs stay linked by task_id; their snapshots keep where it was when checked.
 */
export const moveTask = (db: D1Database, actor: Actor, id: number, sectionId: number) => moveItem(db, actor, "task", id, sectionId);

/** Moves a section, with all its tasks, to the end of another live department in the same list (US-12a). */
export const moveSection = (db: D1Database, actor: Actor, id: number, categoryId: number) =>
  moveItem(db, actor, "section", id, categoryId);

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
 * hidden department/section it sits in, all in one transaction. Each item brought back is logged.
 */
export async function restore(
  db: D1Database,
  actor: Actor,
  kind: StructureKind,
  id: number,
  withParents: boolean,
): Promise<RestoreResult> {
  const table = TABLE[kind];
  const itemHidden = `EXISTS (SELECT 1 FROM ${table} WHERE id = ?1 AND deleted_at IS NOT NULL)`;
  const listLive = `${LIST_OF[kind]} IN (${LIVE_LISTS})`;
  // A logged restore of one row: the log row (if `guard` holds for it), then the change only if it was logged.
  const restoreRow = (k: StructureKind, rowId: string, guard: string) => {
    const a = LOG_SQL[k].alias;
    return [
      bindWithActor(
        db.prepare(
          logSql(k, "restore", {
            where: `${a}.id = ${rowId} AND ${a}.deleted_at IS NOT NULL AND ${guard}`,
            after: `json_object('place', ${LOG_SQL[k].place})`,
          }),
        ),
        actor,
        id,
      ),
      db.prepare(`UPDATE ${TABLE[k]} SET deleted_at = NULL WHERE id = ${rowId} AND changes() = 1`).bind(id),
    ];
  };
  const parents = withParents ? ANCESTORS[kind].flatMap((p) => restoreRow(p.kind, p.id, `${itemHidden} AND ${listLive}`)) : [];
  const results = await db.batch([
    ...parents,
    ...restoreRow(kind, "?1", `${LOG_SQL[kind].alias}.${PARENT[kind]} IN (${LIVE_PARENTS[kind]})`),
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
