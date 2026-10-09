import { Hono } from "hono";
import { getServiceChecklist } from "../db/checklist";
import { getCurrentService } from "../db/services";
import { requireAccess } from "../middleware/auth";
import type { AppEnv } from "../types";

/** The current service's checklist with its check-offs (US-05, US-07). */
export const checklistRoutes = new Hono<AppEnv>().get("/", requireAccess, async (c) => {
  const service = await getCurrentService(c.env.DB, new Date());
  const checklist = service && (await getServiceChecklist(c.env.DB, service));
  if (!checklist) return c.json({ error: "No default checklist is set up yet." }, 404);
  return c.json(checklist);
});
