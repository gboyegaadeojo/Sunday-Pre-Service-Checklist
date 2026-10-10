import { Hono } from "hono";
import type { DevSignInRequest, DevUsersResponse } from "../../shared/types";
import { verifyMembership } from "../db/schedule-view";
import { signInWithIdentity } from "../db/users";
import { readFakeScheduleState } from "../dev/fake-schedule";
import { FAKE_USERS } from "../dev/fake-users";
import { startSession } from "../middleware/auth";
import type { AppEnv } from "../types";

/** US-04b. Stage 9's Planning Center sign-in shows the same message when it can't reach Planning Center. */
const SIGN_IN_UNAVAILABLE = "Planning Center sign-in is temporarily unavailable. Please try again shortly.";

// Fake sign-in, local development only. A factory rather than a module-level router so that the
// production build, which never calls it, drops this module and the test users entirely.
// Even locally it answers only when DEV_AUTH is "true"; otherwise every path returns 404.
export const createDevAuthRoutes = () =>
  new Hono<AppEnv>()
    .use(async (c, next) => {
      if (c.env.DEV_AUTH !== "true") return c.json({ error: "Not found" }, 404);
      await next();
    })
    .get("/users", (c) =>
      c.json<DevUsersResponse>({
        users: FAKE_USERS.map(({ key, name, description }) => ({ key, name, description })),
      }),
    )
    .post("/sign-in", async (c) => {
      const body = await c.req.json<DevSignInRequest>().catch(() => null);
      const fake = FAKE_USERS.find((u) => u.key === body?.key);
      if (!fake) return c.json({ error: "Unknown test user." }, 400);
      // The main "Sign in with Planning Center" button stands in for Planning Center sign-in: while the fake is
      // "down", it fails as Planning Center's would (US-04b). The developer buttons skip this.
      if (body?.viaPlanningCenter && (await readFakeScheduleState(c.env.DB)).down) {
        return c.json({ error: SIGN_IN_UNAVAILABLE }, 503);
      }

      // The test users are the "dev" sign-in provider (sources/identity.ts): same path as any real provider.
      const userId = await signInWithIdentity(
        c.env.DB,
        {
          identity: { provider: "dev", subject: fake.key, name: fake.name, avatarUrl: null, email: null },
          onMediaTeam: fake.onMediaTeam,
          initialRoles: { isAdmin: fake.isAdmin, isDirector: fake.isDirector },
        },
        new Date().toISOString(),
      );
      // Once team mapping is set up, the fake schedule's rosters decide access, as Planning Center's will (US-02).
      await verifyMembership(c.env.DB, c.var.schedule, userId, new Date());
      await startSession(c, userId);
      return c.body(null, 204);
    });
