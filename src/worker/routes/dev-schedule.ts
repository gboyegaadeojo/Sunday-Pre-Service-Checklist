import { Hono } from "hono";
import { type FakeScheduleState, readFakeScheduleState, writeFakeScheduleState } from "../dev/fake-schedule";
import { clearCache } from "../sources/cache";
import type { AppEnv } from "../types";

// Adjusting the fake schedule source, local development only (like dev-auth.ts: a factory, mounted only inside the
// import.meta.env.DEV branch, answering only when DEV_AUTH is "true"). Teams and positions changed here show once the
// cached schedule expires or an Admin presses "Refresh", as with a real change in Planning Center; switching it up or
// down takes effect at once (the cache is cleared), so the outage screens can be tried straight away.
//   GET /api/dev/schedule  the adjustments
//   PUT /api/dev/schedule  { addedTeams?, addedPositions?, renamedPositions?, removedPositions?, unpublished?, down?, delayMs? }
//                          replaces the adjustments
export const createDevScheduleRoutes = () =>
  new Hono<AppEnv>()
    .use(async (c, next) => {
      if (c.env.DEV_AUTH !== "true") return c.json({ error: "Not found" }, 404);
      await next();
    })
    .get("/", async (c) => c.json<FakeScheduleState>(await readFakeScheduleState(c.env.DB)))
    .put("/", async (c) => {
      const body = await c.req.json<FakeScheduleState>().catch(() => null);
      if (!body || typeof body !== "object") return c.json({ error: "Send the adjustments as JSON." }, 400);
      const before = await readFakeScheduleState(c.env.DB);
      await writeFakeScheduleState(c.env.DB, body);
      if (Boolean(before.down) !== Boolean(body.down)) await clearCache(c.env.DB, "fake:");
      return c.body(null, 204);
    });
