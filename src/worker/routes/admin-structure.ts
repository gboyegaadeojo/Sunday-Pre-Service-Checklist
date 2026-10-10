import { type Context, Hono } from "hono";
import {
  type AdminListResponse,
  type ApiErrorBody,
  type CreatedResponse,
  type HiddenItemsResponse,
  NAME_MAX,
  type StructureKind,
  TASK_TEXT_MAX,
} from "../../shared/types";
import {
  type MoveResult,
  addCategory,
  addSection,
  addTask,
  editTask,
  getAdminList,
  getHiddenItems,
  hideCategory,
  hideSection,
  hideTask,
  moveSection,
  moveTask,
  renameCategory,
  renameSection,
  reorder,
  restore,
} from "../db/admin-structure";
import { requireAdmin } from "../middleware/auth";
import type { AppEnv } from "../types";

// Admin checklist editor, Stage 5 (US-12, US-12a, US-13, US-13a). Admins only, enforced here.
//   GET    /api/admin/lists/:listId                  structure ("default" or an ID)
//   GET    /api/admin/lists/:listId/hidden           hidden items, newest first
//   POST   /api/admin/lists/:listId/categories      { name }  add a department at the end
//   POST   /api/admin/categories/:id/sections        { name }  add a section at the end
//   POST   /api/admin/sections/:id/tasks             { text }  add a task at the end
//   PATCH  /api/admin/categories/:id | sections/:id  { name }  rename
//   PATCH  /api/admin/tasks/:id                      { text }  edit text
//   DELETE /api/admin/categories/:id | sections/:id | tasks/:id   hide (never erased)
//   POST   /api/admin/{categories|sections|tasks}/:id/reorder  { direction: "up" | "down" }
//   POST   /api/admin/tasks/:id/move                 { sectionId }   to the end of that section
//   POST   /api/admin/sections/:id/move              { categoryId }  to the end of that department
//   POST   /api/admin/{categories|sections|tasks}/:id/restore  { withParents? }

const notFound = (c: Context<AppEnv>) =>
  c.json<ApiErrorBody>({ error: "That item no longer exists. Reload to see the latest checklist." }, 404);

const toId = (value: unknown) => {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n > 0 ? n : null;
};
const id = (c: Context<AppEnv>) => toId(c.req.param("id"));

const readBody = async (c: Context<AppEnv>) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;

/** Reads a trimmed, non-empty string field within a length limit; returns an error message otherwise. */
async function readText(c: Context<AppEnv>, field: "name" | "text", max: number): Promise<string | { error: string }> {
  const body = await readBody(c);
  const value = typeof body[field] === "string" ? body[field].trim() : "";
  const label = field === "name" ? "Name" : "Task text";
  if (!value) return { error: `${label} can't be empty.` };
  if (value.length > max) return { error: `${label} can be at most ${max} characters.` };
  return value;
}

type Op = (db: D1Database, id: number, value: string) => Promise<boolean | number | null>;

function textRoute(field: "name" | "text", max: number, op: Op, created: boolean) {
  return async (c: Context<AppEnv>) => {
    const target = id(c);
    if (target === null) return notFound(c);
    const value = await readText(c, field, max);
    if (typeof value !== "string") return c.json<ApiErrorBody>(value, 400);
    const result = await op(c.env.DB, target, value);
    if (result === false || result === null) return notFound(c);
    return created ? c.json<CreatedResponse>({ id: result as number }, 201) : c.body(null, 204);
  };
}

function hideRoute(op: (db: D1Database, id: number) => Promise<boolean>) {
  return async (c: Context<AppEnv>) => {
    const target = id(c);
    if (target === null || !(await op(c.env.DB, target))) return notFound(c);
    return c.body(null, 204);
  };
}

function reorderRoute(kind: StructureKind) {
  return async (c: Context<AppEnv>) => {
    const target = id(c);
    if (target === null) return notFound(c);
    const { direction } = await readBody(c);
    if (direction !== "up" && direction !== "down") return c.json<ApiErrorBody>({ error: 'Direction must be "up" or "down".' }, 400);
    const result = await reorder(c.env.DB, kind, target, direction);
    if (result === "not_found") return notFound(c);
    if (result === "edge") return c.json<ApiErrorBody>({ error: direction === "up" ? "It's already first." : "It's already last." }, 409);
    if (result === "conflict") return c.json<ApiErrorBody>({ error: "Someone else changed this list just now. Try again." }, 409);
    return c.body(null, 204);
  };
}

function moveRoute(field: "sectionId" | "categoryId", op: (db: D1Database, id: number, to: number) => Promise<MoveResult>) {
  const destination = field === "sectionId" ? "section" : "department";
  return async (c: Context<AppEnv>) => {
    const target = id(c);
    if (target === null) return notFound(c);
    const to = toId((await readBody(c))[field]);
    if (to === null) return c.json<ApiErrorBody>({ error: `Choose a ${destination} to move it to.` }, 400);
    const result = await op(c.env.DB, target, to);
    if (result === "same_place") return c.json<ApiErrorBody>({ error: `It's already in that ${destination}.` }, 400);
    if (result === "not_found") {
      return c.json<ApiErrorBody>({ error: `That item or ${destination} no longer exists. Reload to see the latest checklist.` }, 404);
    }
    return c.body(null, 204);
  };
}

function restoreRoute(kind: StructureKind) {
  return async (c: Context<AppEnv>) => {
    const target = id(c);
    if (target === null) return notFound(c);
    const withParents = (await readBody(c)).withParents === true;
    const result = await restore(c.env.DB, kind, target, withParents);
    if (result === "not_found") return c.json<ApiErrorBody>({ error: "That item isn't hidden anymore. Reload to see the latest." }, 404);
    if (result === "parent_hidden") {
      return c.json<ApiErrorBody>(
        { error: "It's inside a hidden department or section. Restore that first, or restore both together.", code: "parent_hidden" },
        409,
      );
    }
    return c.body(null, 204);
  };
}

const listRef = (c: Context<AppEnv>) => (c.req.param("id") === "default" ? "default" : id(c));

export const adminStructureRoutes = new Hono<AppEnv>()
  .use(requireAdmin)
  .get("/lists/:id", async (c) => {
    const ref = listRef(c);
    const list = ref === null ? null : await getAdminList(c.env.DB, ref);
    if (!list) return c.json<ApiErrorBody>({ error: "No checklist found." }, 404);
    return c.json<AdminListResponse>(list);
  })
  .get("/lists/:id/hidden", async (c) => {
    const ref = listRef(c);
    const hidden = ref === null ? null : await getHiddenItems(c.env.DB, ref);
    if (!hidden) return c.json<ApiErrorBody>({ error: "No checklist found." }, 404);
    return c.json<HiddenItemsResponse>(hidden);
  })
  .post("/lists/:id/categories", textRoute("name", NAME_MAX, addCategory, true))
  .post("/categories/:id/sections", textRoute("name", NAME_MAX, addSection, true))
  .post("/sections/:id/tasks", textRoute("text", TASK_TEXT_MAX, addTask, true))
  .patch("/categories/:id", textRoute("name", NAME_MAX, renameCategory, false))
  .patch("/sections/:id", textRoute("name", NAME_MAX, renameSection, false))
  .patch("/tasks/:id", textRoute("text", TASK_TEXT_MAX, editTask, false))
  .delete("/categories/:id", hideRoute(hideCategory))
  .delete("/sections/:id", hideRoute(hideSection))
  .delete("/tasks/:id", hideRoute(hideTask))
  .post("/categories/:id/reorder", reorderRoute("category"))
  .post("/sections/:id/reorder", reorderRoute("section"))
  .post("/tasks/:id/reorder", reorderRoute("task"))
  .post("/sections/:id/move", moveRoute("categoryId", moveSection))
  .post("/tasks/:id/move", moveRoute("sectionId", moveTask))
  .post("/categories/:id/restore", restoreRoute("category"))
  .post("/sections/:id/restore", restoreRoute("section"))
  .post("/tasks/:id/restore", restoreRoute("task"));
