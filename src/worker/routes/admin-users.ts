import { Hono } from "hono";
import type { ApiErrorBody, RoleEditsResponse, UpdateRolesResponse, UsersResponse } from "../../shared/types";
import { getRoleEvents, getUsers, setRoles } from "../db/roles";
import { actorFor } from "../lib/actor";
import { requireAdmin } from "../middleware/auth";
import type { AppEnv } from "../types";

// People and their roles (Stage 6, US-03). Admins only, enforced here.
//   GET /api/admin/users              everyone who has signed in, with their roles
//   PUT /api/admin/users/:id/roles    { isAdmin, isDirector }  saves and logs what changed; never removes the last Admin
//   GET /api/admin/users/events       the append-only role log, newest first
// A change takes effect on that person's next request (roles are re-read every time, middleware/auth.ts).

/** There must always be at least one Admin (US-03). */
export const LAST_ADMIN_MESSAGE = "You can't remove the last Admin. Make someone else an Admin first.";
export const adminUserRoutes = new Hono<AppEnv>()
  .use(requireAdmin)
  .get("/", async (c) => c.json<UsersResponse>(await getUsers(c.env.DB)))
  .get("/events", async (c) => c.json<RoleEditsResponse>(await getRoleEvents(c.env.DB)))
  .put("/:id/roles", async (c) => {
    const id = Number(c.req.param("id"));
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!Number.isInteger(id) || typeof body?.isAdmin !== "boolean" || typeof body?.isDirector !== "boolean") {
      return c.json<ApiErrorBody>({ error: "Send isAdmin and isDirector as true or false." }, 400);
    }
    const result = await setRoles(c.env.DB, actorFor(c), id, { isAdmin: body.isAdmin, isDirector: body.isDirector });
    if (result.ok) return c.json<UpdateRolesResponse>({ changed: result.changed });
    if (result.reason === "not_found") return c.json<ApiErrorBody>({ error: "That person wasn't found." }, 404);
    if (result.reason === "last_admin") {
      return c.json<ApiErrorBody>({ error: LAST_ADMIN_MESSAGE, code: "last_admin" }, 409);
    }
    return c.json<ApiErrorBody>({ error: "Their roles were just changed by someone else. Showing the latest." }, 409);
  });
