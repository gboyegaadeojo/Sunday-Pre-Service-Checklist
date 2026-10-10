import { useCallback, useEffect, useState } from "react";
import type {
  ActivityEvent,
  ActivityResponse,
  ChecklistEditEvent,
  ChecklistEditsResponse,
  EditAction,
  EditEntity,
  EditPlace,
} from "../../shared/types";
import { getJson, isAuthError } from "../api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { formatServiceDate } from "../lib/format";

const ACTION: Record<ActivityEvent["action"], { label: string; tone: string }> = {
  check: { label: "Checked", tone: "text-success" },
  uncheck: { label: "Unchecked", tone: "text-fg" },
  reset: { label: "Reset checklist", tone: "text-danger" },
  undo_reset: { label: "Undid reset", tone: "text-warning" },
};

const OUTCOME: Record<Exclude<ActivityEvent["outcome"], "applied">, string> = {
  no_change: "No change",
  not_found: "Task not on checklist",
  service_changed: "Service had ended",
};

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

type Filter = "all" | "checkoffs" | "edits";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "checkoffs", label: "Check-offs" },
  { value: "edits", label: "Checklist edits" },
];

/** "9:42:10 AM" today in the church's time zone; "Oct 4, 9:42 AM" for older entries (edits can be from any day). */
function formatWhen(iso: string, timeZone: string, today: string) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(iso));
  const options: Intl.DateTimeFormatOptions =
    day === today ? { hour: "numeric", minute: "2-digit", second: "2-digit" } : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone }).format(new Date(iso));
}

const short = (id: string | null) => (id ? id.slice(0, 8) : "—");

function describeCheckoff(e: ActivityEvent): string {
  if (e.action === "reset") return `${e.affected ?? 0} check-off${e.affected === 1 ? "" : "s"} cleared`;
  if (e.action === "undo_reset") return `${e.affected ?? 0} check-off${e.affected === 1 ? "" : "s"} restored`;
  return e.taskText ?? `Task #${e.taskId} (no longer exists)`;
}

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

type Entry = { type: "checkoff"; event: ActivityEvent } | { type: "edit"; event: ChecklistEditEvent };

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; checkoffs: ActivityResponse; edits: ChecklistEditsResponse };

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
      const [checkoffs, edits] = await Promise.all([
        getJson<ActivityResponse>("/api/services/current/events"),
        getJson<ChecklistEditsResponse>("/api/admin/edits"),
      ]);
      setState({ status: "ready", checkoffs, edits });
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
  const entries: Entry[] = [
    ...(filter === "edits" ? [] : state.checkoffs.events.map((event) => ({ type: "checkoff" as const, event }))),
    ...(filter === "checkoffs" ? [] : state.edits.events.map((event) => ({ type: "edit" as const, event }))),
  ].sort((a, b) => b.event.at.localeCompare(a.event.at));
  // With more than one list in the feed, name the list of each department/section/task edit.
  const manyLists = new Set(state.edits.events.map((e) => e.list.id)).size > 1;
  const truncated =
    (filter !== "edits" && state.checkoffs.truncated) || (filter !== "checkoffs" && state.edits.truncated);

  return (
    <main className="mx-auto max-w-app space-y-4 px-4 pt-4 pb-16 md:px-6 md:pt-6">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="max-w-2xl">
          <h1 className="text-page font-semibold tracking-tight">Activity</h1>
          <p className="text-meta text-fg-muted">
            Check-offs, resets and undos for {formatServiceDate(service.date)}, and changes to the checklist, newest first.
            Entries can't be edited or deleted. Session and tab IDs show which sign-in and which browser tab made each change.
          </p>
        </div>
        <Button onClick={() => void load()} disabled={refreshing}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </header>

      <fieldset className="inline-flex flex-wrap gap-1 rounded-control border border-line bg-card p-1">
        <legend className="sr-only">Show</legend>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={`min-h-11 rounded-control px-3 text-sm transition-colors ${
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
              : filter === "checkoffs"
                ? "No check-offs yet for this service."
                : "No activity yet."
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <ol className="divide-y divide-line">
            {entries.map(({ type, event: e }) => {
              const action = type === "checkoff" ? ACTION[(e as ActivityEvent).action] : EDIT[(e as ChecklistEditEvent).action];
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
                    {type === "checkoff" ? describeCheckoff(e as ActivityEvent) : describeEdit(e as ChecklistEditEvent)}
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
                    session {short(e.sessionId)} · tab {short(e.tabId)}
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
