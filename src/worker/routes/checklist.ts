import { Hono } from "hono";
import type { ChecklistResponse } from "../../shared/types";
import { getServiceChecklist } from "../db/checklist";
import { getLatestReset } from "../db/resets";
import { attachPlan, getChecklistView } from "../db/schedule-view";
import { getCurrentService } from "../db/services";
import type { User } from "../db/users";
import { requireAccess } from "../middleware/auth";
import type { AppEnv } from "../types";

/**
 * The current service's checklist with its check-offs (US-05, US-07). Also the data for the progress
 * view, which everyone with access may see (US-09). Reset details go to Admins and Directors only (US-17).
 * `view` says which departments this person sees first, or only, from the schedule (US-05, Stage 7b).
 */
export const checklistRoutes = new Hono<AppEnv>().get("/", requireAccess, async (c) => {
  const current = await getCurrentService(c.env.DB, new Date());
  const service = current && (await attachPlan(c.env.DB, c.var.schedule, current));
  const checklist = service && (await getServiceChecklist(c.env.DB, service));
  if (!service || !checklist) return c.json({ error: "No default checklist is set up yet." }, 404);

  const user = c.var.user as User;
  if (user.isAdmin || user.isDirector) checklist.service.reset = await getLatestReset(c.env.DB, service.id);
  const view = await getChecklistView(
    c.env.DB,
    c.var.schedule,
    user,
    service,
    checklist.categories.map((d) => d.id),
  );
  return c.json<ChecklistResponse>({ ...checklist, view });
});
