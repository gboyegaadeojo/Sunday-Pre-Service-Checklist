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
  /** The schedule source has a plan for it (Stage 7). False shows the "No service is published" note (US-05). */
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
  /**
   * The task text: for a past service, as it was when last checked in that service (US-06); for the current
   * service, its current text. null for service-wide actions or unknown tasks.
   */
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
  code?: "signed_out" | "no_access" | "forbidden" | "service_changed" | "nothing_to_reset" | "nothing_to_undo" | "parent_hidden" | "last_admin";
}

export interface CurrentUser {
  /** Internal app user ID (US-03a). Never a sign-in provider's ID. */
  id: number;
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

// Admin checklist editor (Stage 5). Admin-only endpoints under /api/admin.

/** Longest department/section name and task text the editor accepts (trimmed). */
export const NAME_MAX = 120;
export const TASK_TEXT_MAX = 500;

export interface AdminTask {
  id: number;
  text: string;
}

export interface AdminSection {
  id: number;
  name: string;
  tasks: AdminTask[];
}

export interface AdminCategory {
  id: number;
  name: string;
  /** Planning Center team/position links that hiding this department would remove (US-12). */
  linkCount: number;
  sections: AdminSection[];
}

/** GET /api/admin/lists/:listId (listId may be "default"): the list's live structure. */
export interface AdminListResponse {
  list: { id: number; name: string; description: string | null; isDefault: boolean };
  categories: AdminCategory[];
}

/** POST that creates an item. */
export interface CreatedResponse {
  id: number;
}

/** Department, section or task: the three editable levels of a list. */
export type StructureKind = "category" | "section" | "task";

/** POST /api/admin/{categories|sections|tasks}/:id/reorder */
export interface ReorderRequest {
  direction: "up" | "down";
}

/** POST /api/admin/tasks/:id/move */
export interface MoveTaskRequest {
  sectionId: number;
}

/** POST /api/admin/sections/:id/move */
export interface MoveSectionRequest {
  categoryId: number;
}

/** POST /api/admin/{categories|sections|tasks}/:id/restore (US-13a) */
export interface RestoreRequest {
  /** Also restore the hidden department/section it sits in, in the same transaction. */
  withParents?: boolean;
}

/** The department or section a hidden item sits in. It may be hidden too. */
export interface HiddenParent {
  id: number;
  name: string;
  hidden: boolean;
}

/** An item hidden on its own (its deleted_at is set). Items inside it come back with it. */
export interface HiddenItem {
  kind: StructureKind;
  id: number;
  /** Name, or the task's text. */
  name: string;
  hiddenAt: string;
  /** For sections and tasks. */
  category?: HiddenParent;
  /** For tasks. */
  section?: HiddenParent;
  /** What restoring brings back with it (for departments and sections). */
  sectionCount?: number;
  taskCount?: number;
}

/** GET /api/admin/lists/:listId/hidden: hidden items, newest first. */
export interface HiddenItemsResponse {
  list: { id: number; name: string };
  /** The church's IANA time zone (setting), for showing when items were hidden. */
  timeZone: string;
  items: HiddenItem[];
}

// Checklist edit log (Stage 5c, US-13b). Admin only.

export type EditAction = "add" | "rename" | "edit" | "hide" | "restore" | "move" | "reorder" | "set_default";

/** What an edit-log entry is about: a whole task list, or a department, section or task in one. */
export type EditEntity = "list" | StructureKind;

/** Where an item sat: its department and section (as named then), and its 1-based position among live siblings. */
export interface EditPlace {
  department?: { id: number; name: string };
  section?: { id: number; name: string };
  position: number;
}

/** Only what changed. */
export interface EditValues {
  name?: string;
  text?: string;
  place?: EditPlace;
  /** Planning Center links removed by hiding a department ("Team › Position"). */
  teamLinks?: string[];
  /** A list's description. */
  description?: string | null;
  /** A new list that started as a copy of this one. */
  copiedFrom?: { id: number; name: string };
  /** set_default: the default list before and after. */
  defaultList?: { id: number; name: string } | null;
  /** set_default: the current service (date) that switched to the new default too. */
  serviceDate?: string | null;
}

/** One row of the append-only checklist edit log. */
export interface ChecklistEditEvent {
  id: number;
  at: string;
  action: EditAction;
  kind: EditEntity;
  /** The list the entry belongs to (for kind "list", the list itself), as named now. */
  list: { id: number; name: string };
  itemId: number;
  /** Its name or text right after this change. */
  itemName: string;
  before: EditValues | null;
  after: EditValues | null;
  user: string;
  sessionId: string | null;
  tabId: string | null;
}

/** GET /api/admin/edits: latest edits across all lists, newest first. */
export interface ChecklistEditsResponse {
  timeZone: string;
  events: ChecklistEditEvent[];
  /** True when older entries exist beyond the returned page. */
  truncated: boolean;
}

// Task lists (Stage 5d.1, US-11). Admin only.

/** Longest list description the server accepts (trimmed). */
export const DESCRIPTION_MAX = 300;

export interface AdminListSummary {
  id: number;
  name: string;
  description: string | null;
  isDefault: boolean;
  /** Live departments and tasks. */
  departmentCount: number;
  taskCount: number;
  createdAt: string;
  /** Set when the list is hidden. */
  hiddenAt: string | null;
}

/** GET /api/admin/lists */
export interface ListsResponse {
  lists: AdminListSummary[];
  /** The current service and the list it uses (a service keeps the list it started with). */
  currentService: { id: number; date: string; listId: number; hasCheckoffs: boolean } | null;
  timeZone: string;
}

/** POST /api/admin/lists */
export interface CreateListRequest {
  name: string;
  description?: string | null;
  /** Copy the live departments, sections and tasks of this list. Omit for an empty list. */
  copyFrom?: number;
}

/** PATCH /api/admin/lists/:id */
export interface UpdateListRequest {
  name: string;
  description?: string | null;
}

/** POST /api/admin/lists/:id/default */
export interface SetDefaultRequest {
  /** Also switch the current service to this list. Allowed only while it has no check-offs. */
  applyToCurrentService?: boolean;
}

// Church settings (Stage 5d.2, US-11a). Admin only, except the branding (GET /api/branding).

/** Longest short name (the logo mark) the server accepts (trimmed). */
export const SHORT_NAME_MAX = 8;
/** Longest team name or app name the server accepts (trimmed). */
export const BRANDING_MAX = 60;

export interface ChurchSettings {
  /** IANA time zone name, e.g. "America/Winnipeg". Empty if missing. */
  timeZone: string;
  /** 0 = Sunday … 6 = Saturday; null if missing or invalid. */
  serviceWeekday: number | null;
  /** Branding; an empty string is left out of the display. */
  shortName: string;
  teamName: string;
  appName: string;
}

export type SettingField = keyof ChurchSettings;

/** GET /api/admin/settings */
export interface SettingsResponse {
  settings: ChurchSettings;
  /** The current service and how many tasks are checked on it now, or null while the calendar settings are invalid. */
  currentService: { date: string; checkedCount: number } | null;
}

/** PUT /api/admin/settings: every field, as the form shows it. */
export type UpdateSettingsRequest = ChurchSettings & { serviceWeekday: number };

export interface UpdateSettingsResponse {
  /** Fields that changed (none if the values were already saved). */
  changed: SettingField[];
  /** The current service date under the saved calendar settings. */
  currentServiceDate: string;
}

/** One entry of the append-only settings log: only the fields that changed, before and after. */
export interface SettingsEditEvent {
  id: number;
  at: string;
  before: Partial<Record<SettingField, string | number | null>>;
  after: Partial<Record<SettingField, string | number | null>>;
  user: string;
  sessionId: string | null;
  tabId: string | null;
}

/** GET /api/admin/settings/events, newest first. */
export interface SettingsEditsResponse {
  events: SettingsEditEvent[];
  truncated: boolean;
}

/** One service in GET /api/admin/history (Stage 5d.3, design.md §7). */
export interface ServiceSummary {
  id: number;
  /** "YYYY-MM-DD" in the church's time zone. */
  date: string;
  /** The list the service used, by its current name (it may since have been hidden). */
  list: { id: number; name: string; hidden: boolean };
  /** Tasks checked at the end. With a record: only tasks still on the checklist then (the X of "X of Y"). */
  checkedCount: number;
  /** Tasks on the checklist at the end of the service (the Y), or null when it has no record (US-07b). */
  totalCount: number | null;
  resetCount: number;
}

/** GET /api/admin/history: past services, newest first. The current service is left out. */
export interface HistoryResponse {
  services: ServiceSummary[];
  /** True when older services exist beyond the returned page. */
  truncated: boolean;
}

/** Who checked a task and when, and the text it had then (the check-off snapshot, US-06). */
export interface HistoryCheckoff {
  by: string;
  at: string;
  text: string;
}

/**
 * A task as it was at the end of the service (with a record), or as checked (without one). checkoff is null
 * when it wasn't checked; without a record every listed task was checked.
 */
export interface HistoryTask {
  taskId: number;
  text: string;
  checkoff: HistoryCheckoff | null;
}

export interface HistorySection {
  id: number;
  name: string;
  tasks: HistoryTask[];
}

export interface HistoryCategory {
  id: number;
  name: string;
  sections: HistorySection[];
}

/** A task taken off the checklist during the service (hidden, or its section or department hidden). Not counted. */
export interface RemovedTask extends HistoryTask {
  department: string;
  section: string;
  /** When it was removed; null for a checked task that had already gone when the record started. */
  removedAt: string | null;
}

/**
 * GET /api/admin/history/:serviceId.
 * - With a record (US-07b): every task on the checklist at the end of the service, where it was then, checked
 *   or not, plus the tasks removed during the service.
 * - Without one (services from before the record existed): only the tasks still checked at the end, grouped by
 *   the department and section they were in when checked.
 */
export interface ServiceHistoryResponse {
  service: ServiceSummary & {
    timeZone: string;
    isCurrent: boolean;
    /** null: no record. partial: it started after the service did (the service current when this shipped). */
    record: { from: string; partial: boolean } | null;
  };
  categories: HistoryCategory[];
  removed: RemovedTask[];
  /** Every reset of the service, oldest first. */
  resets: Omit<ResetInfo, "canUndo">[];
}

/** One person in GET /api/admin/users (Stage 6, US-03): everyone who has signed in. */
export interface UserSummary {
  /** Internal app user ID (US-03a). */
  id: number;
  name: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  isDirector: boolean;
  /** Verified as a member of a linked media team (US-02). Without it and without a role, they have no access. */
  onMediaTeam: boolean;
  lastSeenAt: string | null;
}

export interface UsersResponse {
  users: UserSummary[];
  timeZone: string;
}

export type RoleField = "isAdmin" | "isDirector";

/** PUT /api/admin/users/:id/roles: both roles, as the screen shows them. */
export type UpdateRolesRequest = Record<RoleField, boolean>;

/** The roles that changed (none if they were already set). */
export interface UpdateRolesResponse {
  changed: RoleField[];
}

/** One entry of the append-only role log: only the roles that changed, before and after. */
export interface RoleEditEvent {
  id: number;
  at: string;
  /** The person whose roles changed, by their name at the time. */
  target: string;
  before: Partial<Record<RoleField, boolean>>;
  after: Partial<Record<RoleField, boolean>>;
  user: string;
  sessionId: string | null;
  tabId: string | null;
}

/** GET /api/admin/users/events, newest first. */
export interface RoleEditsResponse {
  events: RoleEditEvent[];
  truncated: boolean;
}
