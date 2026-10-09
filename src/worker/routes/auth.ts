import { Hono } from "hono";
import type { MeResponse } from "../../shared/types";
import { toCurrentUser } from "../lib/access";
import { endSession, requireUser } from "../middleware/auth";
import type { AppEnv } from "../types";

export const authRoutes = new Hono<AppEnv>()
  .get("/me", requireUser, (c) => {
    // requireUser guarantees a user.
    const user = c.var.user as NonNullable<AppEnv["Variables"]["user"]>;
    return c.json<MeResponse>({ user: toCurrentUser(user) });
  })
  .post("/sign-out", (c) => {
    endSession(c);
    return c.body(null, 204);
  });
