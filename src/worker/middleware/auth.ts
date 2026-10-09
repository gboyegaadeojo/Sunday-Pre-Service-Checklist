import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { ApiErrorBody } from "../../shared/types";
import { getUser, touchUser } from "../db/users";
import { hasAccess } from "../lib/access";
import {
  SESSION_COOKIE,
  SESSION_RENEW_AFTER_SECONDS,
  SESSION_TTL_SECONDS,
  createSessionToken,
  verifySessionToken,
} from "../lib/session";
import type { AppEnv } from "../types";

const nowSeconds = () => Math.floor(Date.now() / 1000);

function sessionSecret(c: Context<AppEnv>): string {
  const secret = c.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set. Add it to .dev.vars locally or as a Worker secret.");
  return secret;
}

// Secure is required in production (US-01). Plain-http local dev (e.g. testing from a phone on
// the LAN) would drop a Secure cookie, so it is only omitted when the request itself is http.
const cookieOptions = (c: Context<AppEnv>) =>
  ({
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/",
  }) as const;

/** Issues the session cookie. A new sign-in gets a new session ID; a renewal passes the existing one. */
export async function startSession(c: Context<AppEnv>, userId: string, now = nowSeconds(), sessionId?: string) {
  const token = await createSessionToken(sessionSecret(c), userId, now, sessionId);
  setCookie(c, SESSION_COOKIE, token, { ...cookieOptions(c), maxAge: SESSION_TTL_SECONDS });
}

export function endSession(c: Context<AppEnv>) {
  deleteCookie(c, SESSION_COOKIE, cookieOptions(c));
}

/** Loads the signed-in user (roles fresh from D1) into c.var.user and renews the 30-day cookie. */
export const loadSession = createMiddleware<AppEnv>(async (c, next) => {
  c.set("user", null);
  c.set("sessionId", null);
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const now = nowSeconds();
    const session = await verifySessionToken(sessionSecret(c), token, now);
    const user = session ? await getUser(c.env.DB, session.sub) : null;
    if (!session || !user) {
      endSession(c);
    } else {
      c.set("user", user);
      c.set("sessionId", session.sid);
      if (now - session.iat >= SESSION_RENEW_AFTER_SECONDS) {
        await touchUser(c.env.DB, user.id, new Date(now * 1000).toISOString());
        await startSession(c, user.id, now, session.sid);
      }
    }
  }
  await next();
});

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.var.user) return c.json<ApiErrorBody>({ error: "Please sign in.", code: "signed_out" }, 401);
  await next();
});

/** Signed in and allowed into the app (US-02). Use on every checklist/data route. */
export const requireAccess = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.var.user;
  if (!user) return c.json<ApiErrorBody>({ error: "Please sign in.", code: "signed_out" }, 401);
  if (!hasAccess(user)) {
    return c.json<ApiErrorBody>(
      {
        error: "This app is for the media team. If you think you should have access, contact a media team admin.",
        code: "no_access",
      },
      403,
    );
  }
  await next();
});
