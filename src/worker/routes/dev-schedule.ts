import { Hono } from "hono";
import { type FakeScheduleState, writeFakeScheduleState } from "../dev/fake-schedule";
import type { AppEnv } from "../types";

// Adjusting the fake schedule source, local development only (like dev-auth.ts: a factory, mounted only inside the
// import.meta.env.DEV branch, answering only when DEV_AUTH is "true"). The change is seen once the cached
// schedule expires or an Admin presses "Refresh" on the mapping screen, as with a real change in Planning Center.
//   PUT /api/dev/schedule  { addedTeams?, addedPositions?, renamedPositions?, removedPositions? }  replaces the adjustments
export const createDevScheduleRoutes = () =>
  new Hono<AppEnv>()
    .use(async (c, next) => {
      if (c.env.DEV_AUTH !== "true") return c.json({ error: "Not found" }, 404);
      await next();
    })
    .put("/", async (c) => {
      const body = await c.req.json<FakeScheduleState>().catch(() => null);
      if (!body || typeof body !== "object") return c.json({ error: "Send the adjustments as JSON." }, 400);
      await writeFakeScheduleState(c.env.DB, body);
      return c.body(null, 204);
    });
