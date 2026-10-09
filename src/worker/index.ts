import { Hono } from "hono";
import { loadSession } from "./middleware/auth";
import { authRoutes } from "./routes/auth";
import { brandingRoutes } from "./routes/branding";
import { checklistRoutes } from "./routes/checklist";
import { checkoffRoutes } from "./routes/checkoffs";
import { createDevAuthRoutes } from "./routes/dev-auth";
import type { AppEnv } from "./types";

// Only /api/* reaches the Worker; pages are static assets (see wrangler.jsonc).
const app = new Hono<AppEnv>();

app.use("/api/*", loadSession);

app.route("/api/auth", authRoutes);
app.route("/api/branding", brandingRoutes);
app.route("/api/checklist", checklistRoutes);
app.route("/api/services", checkoffRoutes);

// Fake sign-in exists only in local development (vite dev server and tests). `vite build` replaces
// import.meta.env.DEV with false, so this branch and the test users are removed from the production
// bundle entirely; DEV_AUTH cannot turn them back on. test/production-build.test.ts proves it.
if (import.meta.env.DEV) {
  app.route("/api/dev", createDevAuthRoutes());
} else {
  let warned = false;
  app.use("/api/*", async (c, next) => {
    if (c.env.DEV_AUTH && !warned) {
      warned = true;
      console.error("DEV_AUTH is set on a production Worker. It is ignored; remove it from the Worker's settings.");
    }
    await next();
  });
}

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Something went wrong. Please try again." }, 500);
});

export default app;
