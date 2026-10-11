import { type Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { verifyMembership } from "../db/schedule-view";
import { signInWithIdentity } from "../db/users";
import { startSession } from "../middleware/auth";
import { ProviderUnavailableError } from "../sources/identity";
import { planningCenterCredentials } from "../sources/planning-center/config";
import { SignInDeclinedError, SignInFailedError, createPlanningCenterSignIn } from "../sources/planning-center/identity";
import type { AppEnv } from "../types";

// Signing in with Planning Center (Stage 9c, US-01, US-04b):
//   GET /api/auth/planning-center/start     → Planning Center's consent page, with a fresh random `state`
//   GET /api/auth/planning-center/callback  ← back from it: check `state`, sign in, start the session, go home
// `state` waits in a short-lived HttpOnly cookie only these two addresses receive, so a callback someone else started
// (a forged link) is refused. Every outcome lands on a page of the app: "/" when signed in, otherwise the sign-in
// screen with ?signin=… saying why (cancelled, unavailable, failed, not_set_up).

const CALLBACK_PATH = "/api/auth/planning-center/callback";
const STATE_COOKIE = "pco_signin_state";
const STATE_PATH = "/api/auth/planning-center";
const STATE_SECONDS = 10 * 60;

/** The callback address on this app's own origin; it must match one registered on the OAuth application. */
const redirectUri = (c: Context<AppEnv>) => new URL(CALLBACK_PATH, c.req.url).toString();
const stateCookie = (c: Context<AppEnv>) => ({
  path: STATE_PATH,
  httpOnly: true,
  sameSite: "Lax" as const, // sent on Planning Center's redirect back (a top-level GET)
  secure: new URL(c.req.url).protocol === "https:",
});

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Compares without stopping at the first difference. */
function sameState(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const back = (c: Context<AppEnv>, reason: "cancelled" | "unavailable" | "failed" | "not_set_up") => c.redirect(`/?signin=${reason}`, 302);

export const planningCenterAuthRoutes = new Hono<AppEnv>()
  .get("/start", (c) => {
    const credentials = planningCenterCredentials(c.env).signIn;
    if (!credentials) return back(c, "not_set_up");
    const state = randomState();
    setCookie(c, STATE_COOKIE, state, { ...stateCookie(c), maxAge: STATE_SECONDS });
    return c.redirect(createPlanningCenterSignIn(credentials).authorizeUrl(redirectUri(c), state), 302);
  })
  .get("/callback", async (c) => {
    const credentials = planningCenterCredentials(c.env).signIn;
    if (!credentials) return back(c, "not_set_up");
    const expected = getCookie(c, STATE_COOKIE);
    deleteCookie(c, STATE_COOKIE, stateCookie(c)); // one use only
    const returned = c.req.query("state");
    if (!expected || !returned || !sameState(expected, returned)) return back(c, "failed");

    let identity: Awaited<ReturnType<ReturnType<typeof createPlanningCenterSignIn>["completeSignIn"]>>;
    try {
      identity = await createPlanningCenterSignIn(credentials).completeSignIn(new URL(c.req.url), redirectUri(c));
    } catch (err) {
      if (err instanceof ProviderUnavailableError) return back(c, "unavailable"); // US-04b
      if (err instanceof SignInDeclinedError) return back(c, "cancelled");
      if (err instanceof SignInFailedError) {
        console.error(`Planning Center sign-in failed: ${err.message}`);
        return back(c, "failed");
      }
      throw err;
    }

    // The same path as any sign-in (US-03a): find or create the app user linked to this account; roles never come
    // from Planning Center. Membership is checked right after, keeping the last confirmation if it can't be (US-04a).
    const now = new Date();
    const userId = await signInWithIdentity(c.env.DB, { identity, onMediaTeam: null }, now.toISOString());
    await verifyMembership(c.env.DB, c.var.schedule, userId, now);
    await startSession(c, userId);
    return c.redirect("/", 302);
  });
