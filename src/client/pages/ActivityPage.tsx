import { useCallback, useEffect, useState } from "react";
import type { ActivityEvent, ActivityResponse } from "../../shared/types";
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

const formatClock = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone }).format(new Date(iso));

const short = (id: string | null) => (id ? id.slice(0, 8) : "—");

function describe(e: ActivityEvent): string {
  if (e.action === "reset") return `${e.affected ?? 0} check-off${e.affected === 1 ? "" : "s"} cleared`;
  if (e.action === "undo_reset") return `${e.affected ?? 0} check-off${e.affected === 1 ? "" : "s"} restored`;
  return e.taskText ?? `Task #${e.taskId} (no longer exists)`;
}

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: ActivityResponse };

// Admin-only view of the append-only activity log for the current service (build plan Stage 4).
// Read-only: entries can't be edited or deleted, here or anywhere.
export function ActivityPage({ onAccessChanged }: { onAccessChanged: () => void }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setState({ status: "ready", data: await getJson<ActivityResponse>("/api/services/current/events") });
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

  const { service, events, truncated } = state.data;
  return (
    <main className="mx-auto max-w-app space-y-4 px-4 pt-4 pb-16 md:px-6 md:pt-6">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="max-w-2xl">
          <h1 className="text-page font-semibold tracking-tight">Activity</h1>
          <p className="text-meta text-fg-muted">
            Every check, uncheck, reset and undo for {formatServiceDate(service.date)}, newest first. Entries can't be edited or
            deleted. Session and tab IDs show which sign-in and which browser tab made each change.
          </p>
        </div>
        <Button onClick={() => void load()} disabled={refreshing}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </header>

      {events.length === 0 ? (
        <EmptyState title="No activity yet for this service." />
      ) : (
        <Card className="overflow-hidden">
          <ol className="divide-y divide-line">
            {events.map((e) => (
              <li key={e.id} className="grid gap-x-4 gap-y-0.5 px-4 py-2.5 text-sm md:grid-cols-[6.5rem_10rem_minmax(0,1fr)_auto]">
                <span className="text-meta text-fg-muted tabular-nums md:text-sm">{formatClock(e.at, service.timeZone)}</span>
                <span className="font-medium wrap-anywhere">
                  <span className={ACTION[e.action].tone}>{ACTION[e.action].label}</span>
                  <span className="font-normal text-fg-muted md:block"> · {e.user}</span>
                </span>
                <span className="min-w-0 wrap-anywhere">
                  {describe(e)}
                  {e.outcome !== "applied" && (
                    <span className="ml-2 inline-block rounded-control border border-line px-1.5 text-meta text-fg-muted">
                      {OUTCOME[e.outcome]}
                    </span>
                  )}
                </span>
                <span className="font-mono text-meta text-fg-muted md:text-right">
                  session {short(e.sessionId)} · tab {short(e.tabId)}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}
      {truncated && <p className="text-meta text-fg-muted">Showing the latest 500 entries.</p>}
    </main>
  );
}
