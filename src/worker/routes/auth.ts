import { Hono } from "hono";
import type { MeResponse, SignInOptionsResponse } from "../../shared/types";
import { syncScheduledDirectors, withScheduledDirector } from "../db/scheduled-directors";
import { isTeamMappingReady, verifyMembership } from "../db/schedule-view";
import { getUser } from "../db/users";
import { toCurrentUser } from "../lib/access";
import { endSession, requireUser } from "../middleware/auth";
import { planningCenterCredentials } from "../sources/planning-center/config";
import type { AppEnv } from "../types";

export const authRoutes = new Hono<AppEnv>()
  .get("/me", requireUser, async (c) => {
    // requireUser guarantees a user.
    const user = c.var.user as NonNullable<AppEnv["Variables"]["user"]>;
    // Each page load re-checks team membership (US-02), so joining or leaving a linked team takes effect then.
    const now = new Date();
    const membership = await verifyMembership(c.env.DB, c.var.schedule, user.id, now);
    // ...and brings the scheduled Director grants up to date (requirements C41), then reads the roles again.
    await syncScheduledDirectors(c.env.DB, c.var.schedule, now);
    const fresh = await withScheduledDirector(c.env.DB, (await getUser(c.env.DB, user.id)) ?? user, now);
    const checked =
      membership === "member" || membership === "not_member"
        ? { ...fresh, teamVerifiedAt: membership === "member" ? now.toISOString() : null }
        : fresh;
    // Unreachable: the last confirmation stands for 90 days; without one, they're told to try again shortly (US-04a).
    const unreachable = membership === "unavailable" ? c.var.schedule?.label : undefined;
    return c.json<MeResponse>({ user: toCurrentUser(checked, await isTeamMappingReady(c.env.DB, c.var.schedule), unreachable) });
  })
  // Public: whether "Sign in with Planning Center" works yet. Says nothing about the credentials themselves.
  .get("/sign-in-options", (c) => c.json<SignInOptionsResponse>({ planningCenter: planningCenterCredentials(c.env).signIn !== null }))
  .post("/sign-out", (c) => {
    endSession(c);
    return c.body(null, 204);
  });
