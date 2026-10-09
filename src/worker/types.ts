import type { User } from "./db/users";

/** Hono environment shared by the app, routes and middleware. */
export interface AppEnv {
  Bindings: Env;
  Variables: {
    /** The signed-in user, re-read from D1 on this request, or null. */
    user: User | null;
    /** The signed-in session's ID (fixed at sign-in), or null. Recorded in the check-off log. */
    sessionId: string | null;
  };
}
