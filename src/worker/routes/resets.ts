import { type Context, Hono } from "hono";
import type { ApiErrorBody, ResetResponse } from "../../shared/types";
import { logRejectedAttempt } from "../db/checkoffs";
import { type ResetResult, getLatestReset, resetService, undoLatestReset } from "../db/resets";
import { getCurrentService } from "../db/services";
import { actorFor } from "../lib/actor";
import { requireStaff } from "../middleware/auth";
import type { AppEnv } from "../types";

// POST /api/services/:serviceId/reset       archive all check-offs of the current service (US-07)
// POST /api/services/:serviceId/undo-reset  restore the latest reset; newer check-offs win (D3)
// Admins and Directors only (US-07, US-10). Every attempt is logged to checkoff_events.

type Action = "reset" | "undo_reset";

async function run(c: Context<AppEnv>, action: Action, perform: typeof resetService) {
  const serviceId = Number(c.req.param("serviceId"));
  if (!Number.isInteger(serviceId)) return c.json<ApiErrorBody>({ error: "Not found" }, 404);
  const actor = actorFor(c);

  const service = await getCurrentService(c.env.DB, new Date());
  if (!service || service.id !== serviceId) {
    await logRejectedAttempt(c.env.DB, { serviceId, taskId: null, action, outcome: "service_changed", actor });
    return c.json<ApiErrorBody>({ error: "That service is no longer current. Showing the current one.", code: "service_changed" }, 409);
  }

  const result: ResetResult = await perform(c.env.DB, service.id, actor);
  if (!result.ok) {
    const error = result.reason === "nothing_to_reset" ? "There are no check-offs to reset." : "There is no reset to undo.";
    return c.json<ApiErrorBody>({ error, code: result.reason }, 409);
  }
  const reset = await getLatestReset(c.env.DB, service.id);
  if (!reset) throw new Error("reset row missing after a successful reset/undo");
  return c.json<ResetResponse>({ reset, affected: result.affected });
}

export const resetRoutes = new Hono<AppEnv>()
  .post("/:serviceId/reset", requireStaff, (c) => run(c, "reset", resetService))
  .post("/:serviceId/undo-reset", requireStaff, (c) => run(c, "undo_reset", undoLatestReset));
