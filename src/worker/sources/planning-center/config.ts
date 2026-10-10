// Planning Center settings (Stage 9, US-01, US-16, US-17). All of them are secrets: .dev.vars locally (gitignored),
// Worker secrets in Cloudflare (Stage 10). None is ever sent to the browser or written into the code.
//
// - PCO_PAT_ID / PCO_PAT_SECRET: a Personal Access Token (an "Application ID" and a "Secret") for reading the church's
//   schedule: Service Types, teams, positions, rosters and plans. The app only ever reads with it (GET requests).
//   For now it belongs to the Admin who manages the church's Planning Center account; it could later move to a
//   dedicated "Media App" Planning Center account with view-only Services access, so it doesn't depend on one person.
// - PCO_CLIENT_ID / PCO_CLIENT_SECRET: the OAuth application volunteers sign in through (People scope only: who they
//   are). Their own Planning Center token is used once and discarded (US-01).
//
// Read through this helper rather than typed on Env: worker-configuration.d.ts is generated from each developer's own
// .dev.vars, so these may or may not appear there, and an empty value counts as not set.

export interface PlanningCenterCredentials {
  /** Reading the schedule: HTTP Basic with the token's Application ID and Secret. */
  schedule: { appId: string; secret: string } | null;
  /** Signing in: the OAuth application's Client ID and Secret. */
  signIn: { clientId: string; clientSecret: string } | null;
}

type MaybeSet = Partial<Record<"PCO_PAT_ID" | "PCO_PAT_SECRET" | "PCO_CLIENT_ID" | "PCO_CLIENT_SECRET", string>>;

const value = (v: string | undefined) => (v && v.trim() !== "" ? v.trim() : null);

/** What's configured. Each half needs both of its values; one without the other counts as not set. */
export function planningCenterCredentials(env: Env): PlanningCenterCredentials {
  const e = env as unknown as MaybeSet;
  const appId = value(e.PCO_PAT_ID);
  const secret = value(e.PCO_PAT_SECRET);
  const clientId = value(e.PCO_CLIENT_ID);
  const clientSecret = value(e.PCO_CLIENT_SECRET);
  return {
    schedule: appId && secret ? { appId, secret } : null,
    signIn: clientId && clientSecret ? { clientId, clientSecret } : null,
  };
}

/**
 * Local development only: which schedule to use, from SCHEDULE_SOURCE in .dev.vars. "planning_center" uses the real
 * one (with the token above); anything else, or nothing, keeps the fake sample schedule, which the tests rely on.
 * Production never reads this: it always uses Planning Center when configured (src/worker/index.ts).
 */
export const wantsRealScheduleLocally = (env: Env) => (env as unknown as { SCHEDULE_SOURCE?: string }).SCHEDULE_SOURCE?.trim() === "planning_center";
