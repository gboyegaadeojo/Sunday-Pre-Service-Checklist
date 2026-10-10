import { env } from "cloudflare:test";
import app from "../src/worker/index";

export const BASE = "https://checklist.test";

/** Calls the Worker app with the test bindings. Paths are resolved against an https origin. */
export const request = (path: string, init: RequestInit = {}, bindings: Partial<Env> = {}) =>
  app.request(new URL(path, BASE).toString(), init, { ...env, ...bindings });

/** "session=..." from a response's Set-Cookie header, or null if none was set. */
export function sessionCookieFrom(res: Response): string | null {
  const match = res.headers.get("Set-Cookie")?.match(/(?:^|,\s*)session=([^;]*)/);
  return match ? `session=${match[1]}` : null;
}

/** Signs in as a fake user and returns the Cookie header value to send on later requests. */
export async function signInAs(key: string): Promise<string> {
  const res = await request("/api/dev/sign-in", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  if (res.status !== 204) throw new Error(`Dev sign-in as ${key} failed: ${res.status}`);
  const cookie = sessionCookieFrom(res);
  if (!cookie) throw new Error("Dev sign-in did not set a session cookie");
  return cookie;
}

export const withCookie = (cookie: string): RequestInit => ({ headers: { Cookie: cookie } });

/** The internal app user ID (US-03a) of a test user, who must have signed in at least once. */
export async function userIdOf(key: string): Promise<number> {
  const row = await env.DB.prepare("SELECT user_id FROM user_identities WHERE provider = 'dev' AND subject = ?")
    .bind(key)
    .first<{ user_id: number }>();
  if (!row) throw new Error(`Test user ${key} has not signed in yet`);
  return row.user_id;
}

/** SQL for a test user's internal ID, for use inside UPDATE … WHERE id = (…). */
export const userIdSql = (key: string) => `(SELECT user_id FROM user_identities WHERE provider = 'dev' AND subject = '${key}')`;
