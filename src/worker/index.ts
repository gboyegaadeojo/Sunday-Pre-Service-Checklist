import { Hono } from "hono";
import { loadSession } from "./middleware/auth";
import { adminHistoryRoutes } from "./routes/admin-history";
import { adminListRoutes } from "./routes/admin-lists";
import { adminMappingRoutes } from "./routes/admin-mapping";
import { adminSettingsRoutes } from "./routes/admin-settings";
import { adminStructureRoutes } from "./routes/admin-structure";
import { adminUserRoutes } from "./routes/admin-users";
import { authRoutes } from "./routes/auth";
import { brandingRoutes } from "./routes/branding";
import { checklistRoutes } from "./routes/checklist";
import { checkoffRoutes } from "./routes/checkoffs";
import { eventRoutes } from "./routes/events";
import { resetRoutes } from "./routes/resets";
import { createFakeScheduleSource } from "./dev/fake-schedule";
import { createDevAuthRoutes } from "./routes/dev-auth";
import { createDevScheduleRoutes } from "./routes/dev-schedule";
import type { AppEnv } from "./types";

// Only /api/* reaches the Worker; pages are static assets (see wrangler.jsonc).
const app = new Hono<AppEnv>();

app.use("/api/*", loadSession);

// The schedule source (requirements C22): the fake one in local development and tests, none in production until
// Planning Center is connected (Stage 9). The fake is created only when import.meta.env.DEV is true, so
// `vite build` drops it and its sample data (test/production-build.test.ts).
app.use("/api/*", async (c, next) => {
  c.set("schedule", import.meta.env.DEV ? createFakeScheduleSource(c.env.DB) : null);
  await next();
});

app.route("/api/auth", authRoutes);
app.route("/api/branding", brandingRoutes);
app.route("/api/checklist", checklistRoutes);
app.route("/api/services", checkoffRoutes);
app.route("/api/services", resetRoutes);
app.route("/api/services", eventRoutes);
app.route("/api/admin", adminStructureRoutes);
app.route("/api/admin", adminListRoutes);
app.route("/api/admin/settings", adminSettingsRoutes);
app.route("/api/admin/history", adminHistoryRoutes);
app.route("/api/admin/users", adminUserRoutes);
app.route("/api/admin/mapping", adminMappingRoutes);

// Fake sign-in exists only in local development (vite dev server and tests). `vite build` replaces
// import.meta.env.DEV with false, so this branch and the test users are removed from the production
// bundle entirely; DEV_AUTH cannot turn them back on. test/production-build.test.ts proves it.
if (import.meta.env.DEV) {
  app.route("/api/dev/schedule", createDevScheduleRoutes());
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
