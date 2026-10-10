import { useCallback, useEffect, useState } from "react";
import type {
  ActivityEvent,
  ActivityResponse,
  ChecklistEditEvent,
  ChecklistEditsResponse,
  EditAction,
  EditEntity,
  EditPlace,
  MappingEditEvent,
  MappingEditsResponse,
  RoleEditEvent,
  RoleEditsResponse,
  RoleField,
  SettingField,
  SettingsEditEvent,
  SettingsEditsResponse,
} from "../../shared/types";
import { getJson, isAuthError } from "../api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { ACTION, OUTCOME, describeCheckoff, formatWhen, short } from "../lib/activity";
import { formatServiceDate } from "../lib/format";

const EDIT: Record<EditAction, { label: string; tone: string }> = {
  add: { label: "Added", tone: "text-accent-soft" },
  rename: { label: "Renamed", tone: "text-accent-soft" },
  edit: { label: "Edited", tone: "text-accent-soft" },
  move: { label: "Moved", tone: "text-accent-soft" },
  reorder: { label: "Reordered", tone: "text-accent-soft" },
  hide: { label: "Hid", tone: "text-danger" },
  restore: { label: "Restored", tone: "text-warning" },
  set_default: { label: "Set default", tone: "text-accent-soft" },
};

const KIND: Record<EditEntity, string> = { list: "List", category: "Department", section: "Section", task: "Task" };

const SETTING: Record<SettingField, string> = {
  timeZone: "Time zone",
  serviceWeekday: "Service day",
  shortName: "Short name",
  teamName: "Team name",
  appName: "App name",
};

type Filter = "all" | "checkoffs" | "edits" | "settings" | "roles" | "mapping";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "checkoffs", label: "Check-offs" },
  { value: "edits", label: "Checklist edits" },
  { value: "settings", label: "Settings" },
  { value: "roles", label: "Roles" },
  { value: "mapping", label: "Mapping" },
];

/** "Audio Engineer › Power On" (the department and section as named at the time). */
const where = (p?: EditPlace) => [p?.department?.name, p?.section?.name].filter(Boolean).join(" › ");

/** What happened to a whole list (US-11), in words. */
function describeListEdit(e: ChecklistEditEvent): string {
  const item = `List “${e.itemName}”`;
  const { before, after } = e;
  switch (e.action) {
    case "add":
      return after?.copiedFrom ? `${item}, copied from “${after.copiedFrom.name}”` : item;
    case "rename": {
      const parts = [
        before?.name !== after?.name ? `List: “${before?.name}” → “${after?.name}”` : item,
        before?.description !== after?.description ? "description changed" : "",
      ];
      return parts.filter(Boolean).join(", ");
    }
    case "set_default": {
      const was = before?.defaultList ? ` (was “${before.defaultList.name}”)` : "";
      const service = after?.serviceDate ? `. ${formatServiceDate(after.serviceDate)} switched to it too` : "";
      return `“${e.itemName}” is now the default list${was}${service}`;
    }
    default:
      return item;
  }
}

/** What changed, in words, from the log entry's before and after values. */
function describeEdit(e: ChecklistEditEvent): string {
  if (e.kind === "list") return describeListEdit(e);
  const item = `${KIND[e.kind]} “${e.itemName}”`;
  const { before, after } = e;
  switch (e.action) {
    case "add":
      return where(after?.place) ? `${item} in ${where(after?.place)}` : item;
    case "rename":
      return `${KIND[e.kind]}: “${before?.name}” → “${after?.name}”`;
    case "edit":
      return `${KIND[e.kind]}: “${before?.text}” → “${after?.text}”`;
    case "move":
      return `${item}: ${where(before?.place)} → ${where(after?.place)}`;
    case "reorder":
      return `${item}: position ${before?.place?.position} → ${after?.place?.position}`;
    case "hide":
      return before?.teamLinks?.length ? `${item}. Removed Planning Center links: ${before.teamLinks.join(", ")}` : item;
    case "restore":
      return where(after?.place) ? `${item} to ${where(after?.place)}` : item;
    default:
      return item;
  }
}

/** One settings value in words: a weekday by name, an empty branding value as "(none)". */
function settingValue(field: SettingField, value: string | number | null | undefined): string {
  if (field === "serviceWeekday") {
    return typeof value === "number"
      ? new Intl.DateTimeFormat(undefined, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(1970, 0, 4 + value)))
      : "(none)";
  }
  return value ? `“${value}”` : "(none)";
}

/** "Service day: Sunday → Saturday; Team name: “A” → “B”" (US-11a). */
const describeSettings = (e: SettingsEditEvent) =>
  (Object.keys(SETTING) as SettingField[])
    .filter((f) => f in e.after)
    .map((f) => `${SETTING[f]}: ${settingValue(f, e.before[f])} → ${settingValue(f, e.after[f])}`)
    .join("; ");

const ROLE: Record<RoleField, string> = { isAdmin: "Admin", isDirector: "Director" };

/** "Test Volunteer: Director added; Admin removed" (US-03). */
const describeRoles = (e: RoleEditEvent) =>
  `${e.target}: ${(Object.keys(ROLE) as RoleField[])
    .filter((f) => f in e.after)
    .map((f) => `${ROLE[f]} ${e.after[f] ? "added" : "removed"}`)
    .join("; ")}`;

/** A team-mapping change in words (Stage 7a, US-15). */
function describeMapping(e: MappingEditEvent): string {
  const { before, after } = e;
  switch (e.action) {
    case "service_type":
      return `Service Type: ${before?.serviceType ?? "(none)"} → ${after?.serviceType}`;
    case "link": {
      const was = before?.department ? ` (was ${before.department.name})` : "";
      return `${e.target} → ${after?.department?.name}${after?.seesAll ? ", sees all departments" : ""}${was}`;
    }
    case "unlink":
      return `${e.target}: link removed (was ${before?.department?.name})`;
    case "sees_all":
      return `${e.target}: ${after?.seesAll ? "now sees" : "no longer sees"} all departments`;
    case "not_media":
      return `${e.target}: ${after?.notMediaTeam ? "marked not a media team" : "no longer marked as not a media team"}`;
    default:
      return e.target;
  }
}

type Entry =
  | { type: "checkoff"; event: ActivityEvent }
  | { type: "edit"; event: ChecklistEditEvent }
  | { type: "setting"; event: SettingsEditEvent }
  | { type: "role"; event: RoleEditEvent }
  | { type: "mapping"; event: MappingEditEvent };

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; checkoffs: ActivityResponse; edits: ChecklistEditsResponse; settings: SettingsEditsResponse; roles: RoleEditsResponse; mapping: MappingEditsResponse };

// Admin-only activity: the append-only check-off log for the current service (Stage 4, US-07a) and the
// append-only checklist edit log (Stage 5c, US-13b), newest first, with a filter. Read-only: entries can't be
// edited or deleted, here or anywhere.
export function ActivityPage({ onAccessChanged }: { onAccessChanged: () => void }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [checkoffs, edits, settings, roles, mapping] = await Promise.all([
        getJson<ActivityResponse>("/api/services/current/events"),
        getJson<ChecklistEditsResponse>("/api/admin/edits"),
        getJson<SettingsEditsResponse>("/api/admin/settings/events"),
        getJson<RoleEditsResponse>("/api/admin/users/events"),
        getJson<MappingEditsResponse>("/api/admin/mapping/events"),
      ]);
      setState({ status: "ready", checkoffs, edits, settings, roles, mapping });
    } catch (err) {
      if (isAuthError(err)) return onAccessChanged();
      setState({ status: "error", message: (err as Error).message });
    } finally {
      setRefreshing(false);
    }
  }, [onAccessChanged]);

  // Load once on arrival; onAccessChanged may be a new function each render, so don't depend on it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional single load
  useEffect(() => {
    void load();
  }, []);

  if (state.status === "loading") return <LoadingState label="Loading activity…" />;
  if (state.status === "error") {
    return (
      <main className="mx-auto max-w-app px-4 py-6 md:px-6">
        <ErrorState title="Couldn't load activity" message={state.message} onRetry={() => void load()} />
      </main>
    );
  }

  const { service } = state.checkoffs;
  const timeZone = service.timeZone;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
  const shows = (f: Exclude<Filter, "all">) => filter === "all" || filter === f;
  const entries: Entry[] = [
    ...(shows("checkoffs") ? state.checkoffs.events.map((event) => ({ type: "checkoff" as const, event })) : []),
    ...(shows("edits") ? state.edits.events.map((event) => ({ type: "edit" as const, event })) : []),
    ...(shows("settings") ? state.settings.events.map((event) => ({ type: "setting" as const, event })) : []),
    ...(shows("roles") ? state.roles.events.map((event) => ({ type: "role" as const, event })) : []),
    ...(shows("mapping") ? state.mapping.events.map((event) => ({ type: "mapping" as const, event })) : []),
  ].sort((a, b) => b.event.at.localeCompare(a.event.at));
  // With more than one list in the feed, name the list of each department/section/task edit.
  const manyLists = new Set(state.edits.events.map((e) => e.list.id)).size > 1;
  const truncated =
    (shows("checkoffs") && state.checkoffs.truncated) ||
    (shows("edits") && state.edits.truncated) ||
    (shows("settings") && state.settings.truncated) ||
    (shows("roles") && state.roles.truncated) ||
    (shows("mapping") && state.mapping.truncated);

  return (
    <main className="mx-auto max-w-app space-y-4 px-4 pt-4 pb-16 md:px-6 md:pt-6">
      <PageHeader
        title="Activity"
        description={
          <>
            Check-offs, resets and undos for {formatServiceDate(service.date)}, and changes to the checklist, settings, roles and team mapping, newest
            first. Entries can't be edited or deleted. Session and tab IDs show which sign-in and which browser tab made each change.
          </>
        }
        actions={
          <Button onClick={() => void load()} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
        }
      />

      <fieldset className="inline-flex flex-wrap gap-1 rounded-control border border-line bg-card p-1">
        <legend className="sr-only">Show</legend>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={`min-h-11 min-w-11 rounded-control px-3 text-sm transition-colors ${
              filter === f.value ? "bg-accent font-semibold text-white" : "text-fg-muted hover:bg-hover hover:text-fg"
            }`}
          >
            {f.label}
          </button>
        ))}
      </fieldset>

      {entries.length === 0 ? (
        <EmptyState
          title={
            filter === "edits"
              ? "No checklist edits yet."
              : filter === "settings"
                ? "No settings changes yet."
                : filter === "roles"
                ? "No role changes yet."
                : filter === "mapping"
                ? "No mapping changes yet."
                : filter === "checkoffs"
                ? "No check-offs yet for this service."
                : "No activity yet."
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <ol className="divide-y divide-line">
            {entries.map(({ type, event: e }) => {
              const action =
                type === "checkoff"
                  ? ACTION[(e as ActivityEvent).action]
                  : type === "edit"
                    ? EDIT[(e as ChecklistEditEvent).action]
                    : type === "setting"
                      ? { label: "Changed settings", tone: "text-accent-soft" }
                      : type === "role"
                        ? { label: "Changed roles", tone: "text-warning" }
                        : { label: "Changed mapping", tone: "text-accent-soft" };
              return (
                <li
                  key={`${type}-${e.id}`}
                  className="grid gap-x-4 gap-y-0.5 px-4 py-2.5 text-sm md:grid-cols-[8.5rem_10rem_minmax(0,1fr)_auto]"
                >
                  <span className="text-meta text-fg-muted tabular-nums md:text-sm">{formatWhen(e.at, timeZone, today)}</span>
                  <span className="font-medium wrap-anywhere">
                    <span className={action.tone}>{action.label}</span>
                    <span className="font-normal text-fg-muted md:block"> · {e.user}</span>
                  </span>
                  <span className="min-w-0 wrap-anywhere">
                    {type === "checkoff"
                      ? describeCheckoff(e as ActivityEvent)
                      : type === "edit"
                        ? describeEdit(e as ChecklistEditEvent)
                        : type === "setting"
                          ? describeSettings(e as SettingsEditEvent)
                          : type === "role"
                            ? describeRoles(e as RoleEditEvent)
                            : describeMapping(e as MappingEditEvent)}
                    {type === "edit" && manyLists && (e as ChecklistEditEvent).kind !== "list" && (
                      <span className="text-fg-muted"> · in “{(e as ChecklistEditEvent).list.name}”</span>
                    )}
                    {type === "checkoff" && (e as ActivityEvent).outcome !== "applied" && (
                      <span className="ml-2 inline-block rounded-control border border-line px-1.5 text-meta text-fg-muted">
                        {OUTCOME[(e as ActivityEvent).outcome as Exclude<ActivityEvent["outcome"], "applied">]}
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-meta text-fg-muted md:text-right">
                    session {short(e.sessionId)}
                    {e.tabId && <> · tab {short(e.tabId)}</>}
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      )}
      {truncated && <p className="text-meta text-fg-muted">Showing the latest 500 entries of each log.</p>}
    </main>
  );
}
