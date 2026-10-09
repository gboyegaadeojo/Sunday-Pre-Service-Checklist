import { type Context, Hono } from "hono";
import { type AdminListResponse, type ApiErrorBody, type CreatedResponse, NAME_MAX, TASK_TEXT_MAX } from "../../shared/types";
import {
  addCategory,
  addSection,
  addTask,
  editTask,
  getAdminList,
  hideCategory,
  hideSection,
  hideTask,
  renameCategory,
  renameSection,
} from "../db/admin-structure";
import { requireAdmin } from "../middleware/auth";
import type { AppEnv } from "../types";

// Admin checklist editor, Stage 5a (US-12, US-12a, US-13). Admins only, enforced here.
//   GET    /api/admin/lists/:listId                  structure ("default" or an ID)
//   POST   /api/admin/lists/:listId/categories      { name }  add a department at the end
//   POST   /api/admin/categories/:id/sections        { name }  add a section at the end
//   POST   /api/admin/sections/:id/tasks             { text }  add a task at the end
//   PATCH  /api/admin/categories/:id | sections/:id  { name }  rename
//   PATCH  /api/admin/tasks/:id                      { text }  edit text
//   DELETE /api/admin/categories/:id | sections/:id | tasks/:id   hide (never erased)

const notFound = (c: Context<AppEnv>) =>
  c.json<ApiErrorBody>({ error: "That item no longer exists. Reload to see the latest checklist." }, 404);

const id = (c: Context<AppEnv>) => {
  const n = Number(c.req.param("id"));
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Reads a trimmed, non-empty string field within a length limit; returns an error message otherwise. */
async function readText(c: Context<AppEnv>, field: "name" | "text", max: number): Promise<string | { error: string }> {
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const value = typeof body?.[field] === "string" ? body[field].trim() : "";
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

export const adminStructureRoutes = new Hono<AppEnv>()
  .use(requireAdmin)
  .get("/lists/:id", async (c) => {
    const ref = c.req.param("id") === "default" ? "default" : id(c);
    const list = ref === null ? null : await getAdminList(c.env.DB, ref);
    if (!list) return c.json<ApiErrorBody>({ error: "No checklist found." }, 404);
    return c.json<AdminListResponse>(list);
  })
  .post("/lists/:id/categories", textRoute("name", NAME_MAX, addCategory, true))
  .post("/categories/:id/sections", textRoute("name", NAME_MAX, addSection, true))
  .post("/sections/:id/tasks", textRoute("text", TASK_TEXT_MAX, addTask, true))
  .patch("/categories/:id", textRoute("name", NAME_MAX, renameCategory, false))
  .patch("/sections/:id", textRoute("name", NAME_MAX, renameSection, false))
  .patch("/tasks/:id", textRoute("text", TASK_TEXT_MAX, editTask, false))
  .delete("/categories/:id", hideRoute(hideCategory))
  .delete("/sections/:id", hideRoute(hideSection))
  .delete("/tasks/:id", hideRoute(hideTask));
