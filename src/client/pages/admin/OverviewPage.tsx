import { AdminShortcuts, useMappingAttention } from "../../components/admin/AdminLayout";
import { RouteLink } from "../../components/app/RouteLink";
import { notPublishedNote } from "../../components/checklist/DepartmentScope";
import { ProgressSummary } from "../../components/progress/ProgressSummary";
import { StatusText } from "../../components/progress/StatusText";
import { Card } from "../../components/ui/Card";
import { ErrorState, LoadingState } from "../../components/ui/States";
import { categoryProgress, progressStatus } from "../../lib/checklist";
import { formatServiceDate, formatTime } from "../../lib/format";
import type { Navigate } from "../../lib/router";
import { useProgress } from "../../lib/useProgress";

// Administrative Settings' landing page (design.md §7): the current service at a glance (the same three figures as
// Progress, each department's status, and the service's status), with a link to Progress, where the details,
// reset and undo live; then a shortcut to each section with a line about it.
export function OverviewPage({ onAccessChanged, onNavigate }: { onAccessChanged: () => void; onNavigate: Navigate }) {
  const { data, loadError, refresh } = useProgress({ onAccessChanged });
  const attention = useMappingAttention("admin-overview");

  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 pt-4 pb-24 md:px-6 md:pt-6">
      <header>
        <h1 className="text-page font-semibold tracking-tight">Overview</h1>
        {data && (
          <p className="text-meta text-fg-muted">
            {data.service.isToday ? "Today's service" : "Upcoming service"} · {formatServiceDate(data.service.date)} · {data.list.name}
          </p>
        )}
      </header>

      {!data ? (
        loadError ? (
          <ErrorState title="Couldn't load the current service" message={loadError} onRetry={refresh} />
        ) : (
          <LoadingState label="Loading the current service…" />
        )
      ) : (
        <>
          <ul className="space-y-1 text-sm" aria-label="Service status">
            <li className="text-fg-muted">
              {data.view.note === "schedule_unavailable"
                ? `Couldn't reach ${data.view.source ?? "the schedule"} just now; the last known plan stands.`
                : data.service.published
                  ? "A plan is published for this service."
                  : notPublishedNote(data.view)}
            </li>
            {data.service.reset && (
              <li className="text-fg-muted">
                Reset by {data.service.reset.by} at {formatTime(data.service.reset.at, data.service.timeZone)}
                {data.service.reset.undoneBy && ` · undone by ${data.service.reset.undoneBy}`}
              </li>
            )}
          </ul>

          <ProgressSummary checklist={data} />

          <Card className="overflow-hidden">
            <h2 className="px-4 pt-3.5 pb-2 text-sm font-semibold md:px-5">Departments</h2>
            <ul className="divide-y divide-line border-t border-line">
              {data.categories.map((d) => {
                const p = categoryProgress(d);
                return (
                  <li key={d.id} className="flex items-center gap-3 px-4 py-3 md:px-5">
                    <span className="min-w-0 flex-1 text-sm font-medium wrap-anywhere">{d.name}</span>
                    <span className="shrink-0 text-meta text-fg-muted tabular-nums">
                      {p.done} of {p.total}
                    </span>
                    <StatusText status={progressStatus(p)} className="w-20 text-right" />
                  </li>
                );
              })}
            </ul>
          </Card>

          <RouteLink
            to="progress"
            current={false}
            onNavigate={onNavigate}
            className="inline-flex min-h-11 items-center justify-center rounded-control border border-line bg-card px-4 text-sm font-medium text-fg transition-colors hover:bg-hover"
          >
            Open Progress for task details, reset and undo
          </RouteLink>
        </>
      )}

      <section aria-labelledby="shortcuts-heading" className="pt-2">
        <h2 id="shortcuts-heading" className="mb-2 text-sm font-semibold">
          Shortcuts
        </h2>
        <AdminShortcuts onNavigate={onNavigate} attention={attention} />
      </section>
    </main>
  );
}
