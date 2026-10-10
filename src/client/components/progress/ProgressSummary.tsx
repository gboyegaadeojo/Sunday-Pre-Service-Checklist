import type { ChecklistResponse } from "../../../shared/types";
import { type ProgressStatus, categoryProgress, checklistProgress, percent, progressStatus } from "../../lib/checklist";
import { Card } from "../ui/Card";
import { ProgressBar } from "../ui/ProgressBar";

/**
 * The service's readiness in three figures (design.md §6): tasks completed of the total, departments in progress,
 * departments not started. Each figure has its words next to it, so colour is never the only signal. Counts only:
 * it never declares the service "ready". Shared by Progress and the Admin Overview.
 */
export function ProgressSummary({ checklist }: { checklist: ChecklistResponse }) {
  const overall = checklistProgress(checklist);
  const departments = (status: ProgressStatus) => checklist.categories.filter((c) => progressStatus(categoryProgress(c)) === status).length;
  const inProgress = departments("in_progress");
  const notStarted = departments("not_started");
  const complete = departments("complete");

  return (
    <Card role="region" aria-label="Overall progress" className="px-4 py-4 md:px-5">
      <dl className="grid grid-cols-3 gap-3">
        <Figure label="Completed" value={overall.done} unit={`of ${overall.total} tasks`} tone={overall.done > 0 ? "text-success" : "text-fg"} />
        <Figure label="In progress" value={inProgress} unit={inProgress === 1 ? "department" : "departments"} tone={inProgress > 0 ? "text-warning" : "text-fg"} />
        <Figure label="Not started" value={notStarted} unit={notStarted === 1 ? "department" : "departments"} tone="text-fg" />
      </dl>
      <div className="mt-4 flex items-center gap-3">
        <ProgressBar progress={overall} label="Overall progress" className="flex-1" />
        <span className="shrink-0 text-meta font-medium tabular-nums">{percent(overall)}%</span>
      </div>
      <p className="mt-1.5 text-meta text-fg-muted tabular-nums">
        {overall.total - overall.done} remaining
        {complete > 0 && ` · ${complete} ${complete === 1 ? "department" : "departments"} complete`}
      </p>
    </Card>
  );
}

function Figure({ label, value, unit, tone }: { label: string; value: number; unit: string; tone: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-meta text-fg-muted">{label}</dt>
      <dd className={`mt-1 text-page leading-none font-semibold tabular-nums ${tone}`}>{value}</dd>
      <dd className="mt-1 text-meta text-fg-muted">{unit}</dd>
    </div>
  );
}
