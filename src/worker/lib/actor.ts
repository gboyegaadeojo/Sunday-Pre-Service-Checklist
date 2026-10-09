import type { Context } from "hono";
import type { Actor } from "../db/checkoffs";
import type { User } from "../db/users";
import type { AppEnv } from "../types";

const TAB_ID = /^[A-Za-z0-9-]{1,64}$/;

/** Who is making this request, for the append-only checkoff_events log. Call only behind an auth guard. */
export function actorFor(c: Context<AppEnv>): Actor {
  const user = c.var.user as User;
  const tabId = c.req.header("X-Tab-Id") ?? "";
  return {
    userId: user.id,
    userName: user.name,
    sessionId: c.var.sessionId,
    tabId: TAB_ID.test(tabId) ? tabId : null,
    userAgent: c.req.header("User-Agent")?.slice(0, 300) ?? null,
  };
}
