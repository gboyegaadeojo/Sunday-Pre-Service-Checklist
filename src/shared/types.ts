// API request/response shapes shared by the Worker and the browser.

/** Who checked a task off for the current service, and when (ISO 8601 UTC). */
export interface TaskCheckoff {
  by: string;
  at: string;
}

export interface ChecklistTask {
  id: number;
  text: string;
  /** Active check-off for this service, or null when unchecked. */
  checkoff: TaskCheckoff | null;
}

export interface ChecklistSection {
  id: number;
  name: string;
  tasks: ChecklistTask[];
}

export interface ChecklistCategory {
  id: number;
  name: string;
  sections: ChecklistSection[];
}

export interface ServiceInfo {
  id: number;
  /** Service date, "YYYY-MM-DD" in the church's time zone. */
  date: string;
  /** The service is today (in the church's time zone), not upcoming. */
  isToday: boolean;
  /** A Planning Center plan exists for it (Stage 7). False shows the "No service is published" note (US-05). */
  published: boolean;
  /** The church's IANA time zone (setting), for showing check-off times. */
  timeZone: string;
  /**
   * Latest reset of this service: only sent to Admins and Directors (US-07, US-17); absent for others.
   * null when the service has never been reset.
   */
  reset?: ResetInfo | null;
}

export interface ResetInfo {
  id: number;
  at: string;
  by: string;
  /** Check-offs it archived. */
  archived: number;
  undoneAt: string | null;
  undoneBy: string | null;
  /** True until it is undone; only the latest reset can be undone, "until the next reset" (US-07). */
  canUndo: boolean;
}

/** POST /api/services/:id/reset and /undo-reset */
export interface ResetResponse {
  reset: ResetInfo;
  /** Check-offs archived (reset) or restored (undo). */
  affected: number;
}

/** One row of the append-only activity log (GET /api/services/:id/events, Admin only). */
export interface ActivityEvent {
  id: number;
  at: string;
  action: "check" | "uncheck" | "reset" | "undo_reset";
  outcome: "applied" | "no_change" | "not_found" | "service_changed";
  taskId: number | null;
  /** The task's current text, or null for service-wide actions or unknown tasks. */
  taskText: string | null;
  affected: number | null;
  user: string;
  sessionId: string | null;
  tabId: string | null;
}

export interface ActivityResponse {
  service: { id: number; date: string; timeZone: string };
  events: ActivityEvent[];
  /** True when older entries exist beyond the returned page. */
  truncated: boolean;
}

export interface ChecklistResponse {
  service: ServiceInfo;
  list: { id: number; name: string };
  categories: ChecklistCategory[];
}

/** PUT/DELETE /api/services/:serviceId/tasks/:taskId/checkoff */
export interface CheckoffResponse {
  checkoff: TaskCheckoff | null;
}

export interface ApiErrorBody {
  error: string;
  /** Lets the client tell "signed out" (401) from "not on a media team" (403). */
  code?: "signed_out" | "no_access" | "forbidden" | "service_changed" | "nothing_to_reset" | "nothing_to_undo";
}

export interface CurrentUser {
  id: string;
  name: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  isDirector: boolean;
  /** False for a signed-in user who is not on a linked media team and has no role (US-02). */
  hasAccess: boolean;
}

/** Church branding from settings (admin-editable). A null field has no value set. */
export interface BrandingResponse {
  shortName: string | null;
  teamName: string | null;
  appName: string | null;
}

export interface MeResponse {
  user: CurrentUser;
}

// Development-only fake sign-in. Never present in production builds (see src/worker/index.ts).
export interface DevUser {
  key: string;
  name: string;
  description: string;
}

export interface DevUsersResponse {
  users: DevUser[];
}

export interface DevSignInRequest {
  key: string;
}
