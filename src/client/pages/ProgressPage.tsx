import { useState } from "react";
import type { ChecklistResponse, CurrentUser } from "../../shared/types";
import { DepartmentProgressCard } from "../components/progress/DepartmentProgressCard";
import { ProgressSummary } from "../components/progress/ProgressSummary";
import { ResetControls } from "../components/progress/ResetControls";
import { Button } from "../components/ui/Button";
import { AlertIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { checklistProgress } from "../lib/checklist";
import { formatServiceDate } from "../lib/format";
import { useProgress } from "../lib/useProgress";

/** Every department (US-09), the person's own first (US-05), as on the checklist. */
const byOwnFirst = ({ categories, view }: ChecklistResponse) => [
  ...view.own.flatMap((id) => categories.filter((c) => c.id === id)),
  ...categories.filter((c) => !view.own.includes(c.id)),
];

const formatClock = (d: Date, timeZone: string) =>
  new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone }).format(d);

// Progress dashboard (US-09, US-10, design.md §6). Everyone with access sees it (requirements v1.6);
// reset/undo appear only for Admins and Directors, and the server enforces that too.
export function ProgressPage({ user, onAccessChanged }: { user: CurrentUser; onAccessChanged: () => void }) {
  const { data, loadError, staleError, updatedAt, refreshing, refresh, runReset } = useProgress({ onAccessChanged });
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const isStaff = user.isAdmin || user.isDirector;

  if (!data) {
    return (
      <main className="mx-auto max-w-app px-4 py-6 md:px-6">
        {loadError ? <ErrorState title="Couldn't load progress" message={loadError} onRetry={refresh} /> : <LoadingState label="Loading progress…" />}
      </main>
    );
  }

  const { service } = data;
  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <main className="mx-auto max-w-app space-y-4 px-4 pt-4 pb-16 md:px-6 md:pt-6">
      <PageHeader
        title="Progress"
        description={
          <>
            {service.isToday ? "Today's service" : "Upcoming service"} · {formatServiceDate(service.date)}
          </>
        }
        actions={
          <>
            <p role="status" className="text-meta text-fg-muted">
              {updatedAt && <>Updated {formatClock(updatedAt, service.timeZone)}</>}
            </p>
            <Button onClick={refresh} disabled={refreshing}>
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
          </>
        }
      />

      {staleError && (
        <p role="alert" className="flex items-start gap-2 rounded-card border border-warning/40 bg-warning/5 px-4 py-2.5 text-sm">
          <AlertIcon className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>
            Couldn't refresh ({staleError}) Showing the numbers from {updatedAt ? formatClock(updatedAt, service.timeZone) : "earlier"}.
          </span>
        </p>
      )}

      <ProgressSummary checklist={data} />

      {isStaff && service.reset !== undefined && (
        <ResetControls
          serviceDate={service.date}
          timeZone={service.timeZone}
          checkedCount={checklistProgress(data).done}
          reset={service.reset}
          onRun={runReset}
        />
      )}

      {data.categories.length === 0 ? (
        <EmptyState title="This checklist has no departments yet." />
      ) : (
        <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
          {byOwnFirst(data).map((d) => (
            <DepartmentProgressCard
              key={d.id}
              department={d}
              timeZone={service.timeZone}
              expanded={expanded.has(d.id)}
              onToggle={() => toggle(d.id)}
              yours={data.view.own.includes(d.id)}
            />
          ))}
        </div>
      )}
    </main>
  );
}
