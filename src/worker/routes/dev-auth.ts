import { Hono } from "hono";
import type { DevSignInRequest, DevUsersResponse } from "../../shared/types";
import { upsertSignedInUser } from "../db/users";
import { FAKE_USERS } from "../dev/fake-users";
import { startSession } from "../middleware/auth";
import type { AppEnv } from "../types";

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

      await upsertSignedInUser(
        c.env.DB,
        {
          id: fake.id,
          name: fake.name,
          avatarUrl: null,
          onMediaTeam: fake.onMediaTeam,
          initialRoles: { isAdmin: fake.isAdmin, isDirector: fake.isDirector },
        },
        new Date().toISOString(),
      );
      await startSession(c, fake.id);
      return c.body(null, 204);
    });
