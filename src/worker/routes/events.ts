import { Hono } from "hono";
import type { ActivityEvent, ActivityResponse, ApiErrorBody } from "../../shared/types";
import { currentServiceDay, getCurrentService } from "../db/services";
import { requireAdmin } from "../middleware/auth";
import type { AppEnv } from "../types";

const PAGE = 500;

interface EventRow {
  id: number;
  created_at: string;
  action: ActivityEvent["action"];
  outcome: ActivityEvent["outcome"];
  task_id: number | null;
  task_text: string | null;
  affected: number | null;
  user_name: string;
  session_id: string | null;
  tab_id: string | null;
}

// GET /api/services/:serviceId/events  the append-only activity log for a service, newest first.
// :serviceId may be "current". Admins only. Read-only: nothing in the app edits or deletes log entries.
// For a past service (history, Stage 5d.3) a task shows the text it had when last checked in that service, from
// the check-off snapshot (US-06), so later edits don't rewrite the record; the current service shows today's text.
export const eventRoutes = new Hono<AppEnv>().get("/:serviceId/events", requireAdmin, async (c) => {
  const param = c.req.param("serviceId");
  const serviceId = param === "current" ? ((await getCurrentService(c.env.DB, new Date(), c.var.schedule))?.id ?? Number.NaN) : Number(param);
  if (!Number.isInteger(serviceId)) return c.json<ApiErrorBody>({ error: "Not found" }, 404);

  const { date: today, timeZone } = await currentServiceDay(c.env.DB, new Date());
  const [serviceResult, eventResult] = await c.env.DB.batch([
    c.env.DB.prepare("SELECT id, service_date FROM services WHERE id = ?").bind(serviceId),
    c.env.DB
      .prepare(
        `SELECT e.id, e.created_at, e.action, e.outcome, e.task_id, e.affected, e.user_name, e.session_id, e.tab_id,
                CASE WHEN s.service_date = ?3 THEN t.text
                     ELSE COALESCE((SELECT k.task_text_snapshot FROM checkoffs k
                                     WHERE k.service_id = e.service_id AND k.task_id = e.task_id
                                     ORDER BY k.id DESC LIMIT 1), t.text) END AS task_text
           FROM checkoff_events e JOIN services s ON s.id = e.service_id LEFT JOIN tasks t ON t.id = e.task_id
          WHERE e.service_id = ?1 ORDER BY e.id DESC LIMIT ?2`,
      )
      .bind(serviceId, PAGE + 1, today),
  ]);
  const service = serviceResult.results[0] as { id: number; service_date: string } | undefined;
  if (!service) return c.json<ApiErrorBody>({ error: "Not found" }, 404);

  const rows = eventResult.results as EventRow[];
  return c.json<ActivityResponse>({
    service: { id: service.id, date: service.service_date, timeZone },
    events: rows.slice(0, PAGE).map((r) => ({
      id: r.id,
      at: r.created_at,
      action: r.action,
      outcome: r.outcome,
      taskId: r.task_id,
      taskText: r.task_text,
      affected: r.affected,
      user: r.user_name,
      sessionId: r.session_id,
      tabId: r.tab_id,
    })),
    truncated: rows.length > PAGE,
  });
});
