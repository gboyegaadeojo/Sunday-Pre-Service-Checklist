import { Hono } from "hono";
import { checklistRoutes } from "./routes/checklist";

// Only /api/* reaches the Worker; pages are static assets (see wrangler.jsonc).
const app = new Hono<{ Bindings: Env }>();

app.route("/api/checklist", checklistRoutes);

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Something went wrong. Please try again." }, 500);
});

export default app;
