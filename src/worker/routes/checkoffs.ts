import { type Context, Hono } from "hono";
import type { ApiErrorBody, CheckoffResponse } from "../../shared/types";
import { type Actor, checkTask, logRejectedAttempt, uncheckTask } from "../db/checkoffs";
import { type Service, getCurrentService } from "../db/services";
import { actorFor } from "../lib/actor";
import { requireAccess } from "../middleware/auth";
import type { AppEnv } from "../types";

// PUT    /api/services/:serviceId/tasks/:taskId/checkoff  check a task off (US-06)
// DELETE /api/services/:serviceId/tasks/:taskId/checkoff  uncheck it
// Anyone with access may check and uncheck. Only the *current* service can be changed: a page left
// open past the end of the service day gets 409 and reloads instead of writing to the wrong service.
// Every attempt that gets this far is written to the append-only checkoff_events log.

type Resolved = { service: Service; taskId: number; actor: Actor } | Response;

async function resolve(c: Context<AppEnv>, action: "check" | "uncheck"): Promise<Resolved> {
  const serviceId = Number(c.req.param("serviceId"));
  const taskId = Number(c.req.param("taskId"));
  if (!Number.isInteger(serviceId) || !Number.isInteger(taskId)) return c.json<ApiErrorBody>({ error: "Not found" }, 404);

  const actor = actorFor(c);
  const service = await getCurrentService(c.env.DB, new Date(), c.var.schedule);
  if (!service || service.id !== serviceId) {
    await logRejectedAttempt(c.env.DB, { serviceId, taskId, action, outcome: "service_changed", actor });
    return c.json<ApiErrorBody>(
      { error: "This checklist is for a service that has ended. Showing the current one.", code: "service_changed" },
      409,
    );
  }
  return { service, taskId, actor };
}

export const checkoffRoutes = new Hono<AppEnv>()
  .put("/:serviceId/tasks/:taskId/checkoff", requireAccess, async (c) => {
    const r = await resolve(c, "check");
    if (r instanceof Response) return r;
    const checkoff = await checkTask(c.env.DB, { serviceId: r.service.id, listId: r.service.listId, taskId: r.taskId, actor: r.actor });
    if (!checkoff) return c.json<ApiErrorBody>({ error: "That task is no longer on this checklist." }, 404);
    return c.json<CheckoffResponse>({ checkoff });
  })
  .delete("/:serviceId/tasks/:taskId/checkoff", requireAccess, async (c) => {
    const r = await resolve(c, "uncheck");
    if (r instanceof Response) return r;
    await uncheckTask(c.env.DB, { serviceId: r.service.id, taskId: r.taskId, actor: r.actor });
    return c.json<CheckoffResponse>({ checkoff: null });
  });
