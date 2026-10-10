import type { User } from "./db/users";
import type { ScheduleSource } from "./sources/schedule";

/** Hono environment shared by the app, routes and middleware. */
export interface AppEnv {
  Bindings: Env;
  Variables: {
    /** The signed-in user, re-read from D1 on this request, or null. */
    user: User | null;
    /** The signed-in session's ID (fixed at sign-in), or null. Recorded in the check-off log. */
    sessionId: string | null;
    /** The schedule source in use (requirements C22), or null when none is connected (production before Stage 8). */
    schedule: ScheduleSource | null;
  };
}
