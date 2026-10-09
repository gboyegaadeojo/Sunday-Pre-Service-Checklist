import { Hono } from "hono";
import { getDefaultChecklist } from "../db/checklist";

export const checklistRoutes = new Hono<{ Bindings: Env }>().get("/", async (c) => {
  const checklist = await getDefaultChecklist(c.env.DB);
  if (!checklist) return c.json({ error: "No default checklist is set up yet." }, 404);
  return c.json(checklist);
});
