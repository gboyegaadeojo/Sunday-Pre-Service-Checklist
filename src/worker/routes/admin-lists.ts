import { type Context, Hono } from "hono";
import {
  type ApiErrorBody,
  type ChecklistEditsResponse,
  type CreatedResponse,
  DESCRIPTION_MAX,
  type ListsResponse,
  NAME_MAX,
} from "../../shared/types";
import { getEdits } from "../db/admin-structure";
import { createList, getLists, hideList, restoreList, setDefaultList, updateList } from "../db/lists";
import { getCurrentService } from "../db/services";
import { actorFor } from "../lib/actor";
import { requireAdmin } from "../middleware/auth";
import type { AppEnv } from "../types";

// Task lists (Stage 5d.1, US-11) and the edit log feed (US-13b). Admins only, enforced here.
//   GET    /api/admin/lists                    all lists, live first, plus the current service's list
//   POST   /api/admin/lists                    { name, description?, copyFrom? }  create, empty or as a copy
//   PATCH  /api/admin/lists/:id                { name, description? }  rename / describe
//   POST   /api/admin/lists/:id/default        { applyToCurrentService? }  make it the default
//   DELETE /api/admin/lists/:id                hide (not the default, not the current service's list)
//   POST   /api/admin/lists/:id/restore        bring a hidden list back
//   GET    /api/admin/edits?list=:id           the append-only checklist edit log, newest first
// Every change is logged to checklist_events in the same transaction (db/lists.ts).

const id = (c: Context<AppEnv>) => {
  const n = Number(c.req.param("id"));
  return Number.isInteger(n) && n > 0 ? n : null;
};

const notFound = (c: Context<AppEnv>) => c.json<ApiErrorBody>({ error: "That list no longer exists. Reload to see the latest." }, 404);

type ListFields = { name: string; description: string | null; copyFrom: number | null } | { error: string };

/** Validated name, description and copyFrom from the body, or an error message. */
async function readListFields(c: Context<AppEnv>): Promise<ListFields> {
  const body = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!name) return { error: "Name can't be empty." };
  if (name.length > NAME_MAX) return { error: `Name can be at most ${NAME_MAX} characters.` };
  if (description.length > DESCRIPTION_MAX) return { error: `Description can be at most ${DESCRIPTION_MAX} characters.` };
  const copyFrom = body.copyFrom === undefined || body.copyFrom === null ? null : Number(body.copyFrom);
  if (copyFrom !== null && !(Number.isInteger(copyFrom) && copyFrom > 0)) return { error: "Choose a list to copy." };
  return { name, description: description || null, copyFrom };
}

export const adminListRoutes = new Hono<AppEnv>()
  .use(requireAdmin)
  .get("/lists", async (c) => {
    return c.json<ListsResponse>(await getLists(c.env.DB, new Date()));
  })
  .post("/lists", async (c) => {
    const fields = await readListFields(c);
    if ("error" in fields) return c.json<ApiErrorBody>({ error: fields.error }, 400);
    const created = await createList(c.env.DB, actorFor(c), fields);
    if (created === null) return c.json<ApiErrorBody>({ error: "The list to copy no longer exists." }, 404);
    return c.json<CreatedResponse>({ id: created }, 201);
  })
  .patch("/lists/:id", async (c) => {
    const target = id(c);
    if (target === null) return notFound(c);
    const fields = await readListFields(c);
    if ("error" in fields) return c.json<ApiErrorBody>({ error: fields.error }, 400);
    if (!(await updateList(c.env.DB, actorFor(c), target, fields.name, fields.description))) return notFound(c);
    return c.body(null, 204);
  })
  .post("/lists/:id/default", async (c) => {
    const target = id(c);
    if (target === null) return notFound(c);
    const body = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const service = body.applyToCurrentService === true ? await getCurrentService(c.env.DB, new Date()) : null;
    const result = await setDefaultList(c.env.DB, actorFor(c), target, service?.id ?? null);
    if (!result.ok && result.reason === "already_default") return c.json<ApiErrorBody>({ error: "It's already the default list." }, 409);
    if (!result.ok) return notFound(c);
    return c.json({ serviceSwitched: result.serviceSwitched });
  })
  .delete("/lists/:id", async (c) => {
    const target = id(c);
    if (target === null) return notFound(c);
    const service = await getCurrentService(c.env.DB, new Date());
    const result = await hideList(c.env.DB, actorFor(c), target, service?.id ?? null);
    if (result === "not_found") return notFound(c);
    if (result === "default") {
      return c.json<ApiErrorBody>({ error: "This is the default list. Make another list the default first." }, 409);
    }
    if (result === "in_use") {
      return c.json<ApiErrorBody>({ error: "The current service uses this list, so it can't be hidden until that service is over." }, 409);
    }
    return c.body(null, 204);
  })
  .post("/lists/:id/restore", async (c) => {
    const target = id(c);
    if (target === null || !(await restoreList(c.env.DB, actorFor(c), target))) {
      return c.json<ApiErrorBody>({ error: "That list isn't hidden anymore. Reload to see the latest." }, 404);
    }
    return c.body(null, 204);
  })
  .get("/edits", async (c) => {
    const param = c.req.query("list");
    const listId = param === undefined ? undefined : Number(param);
    if (listId !== undefined && !(Number.isInteger(listId) && listId > 0)) return notFound(c);
    return c.json<ChecklistEditsResponse>(await getEdits(c.env.DB, listId));
  });
