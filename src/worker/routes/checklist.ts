import { Hono } from "hono";
import { getDefaultChecklist } from "../db/checklist";
import { requireAccess } from "../middleware/auth";
import type { AppEnv } from "../types";

export const checklistRoutes = new Hono<AppEnv>().get("/", requireAccess, async (c) => {
  const checklist = await getDefaultChecklist(c.env.DB);
  if (!checklist) return c.json({ error: "No default checklist is set up yet." }, 404);
  return c.json(checklist);
});
