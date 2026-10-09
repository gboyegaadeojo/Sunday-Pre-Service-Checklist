import type { ChecklistResponse } from "../../../shared/types";
import { type ProgressStatus, categoryProgress, checklistProgress, percent, plural, progressStatus } from "../../lib/checklist";
import { Card } from "../ui/Card";
import { ProgressBar } from "../ui/ProgressBar";
import { StatusDot } from "../ui/StatusDot";

const ORDER: Exclude<ProgressStatus, "empty">[] = ["complete", "in_progress", "not_started"];

// Overall numbers for the service (design.md §6). Counts only: it never declares the service "ready".
export function ProgressSummary({ checklist }: { checklist: ChecklistResponse }) {
  const overall = checklistProgress(checklist);
  const byStatus = new Map<ProgressStatus, number>();
  for (const c of checklist.categories) {
    const s = progressStatus(categoryProgress(c));
    byStatus.set(s, (byStatus.get(s) ?? 0) + 1);
  }

  return (
    <Card role="region" aria-label="Overall progress" className="px-4 py-4 md:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-base">
          <span className="font-semibold tabular-nums">
            {overall.done} of {overall.total}
          </span>{" "}
          <span className="text-fg-muted">tasks done · {overall.total - overall.done} remaining</span>
        </p>
        <p className="text-meta font-medium tabular-nums">{percent(overall)}%</p>
      </div>
      <ProgressBar progress={overall} label="Overall progress" className="mt-2" />
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1" aria-label="Departments by status">
        {ORDER.filter((s) => byStatus.get(s)).map((s) => (
          <li key={s} className="flex items-center gap-1.5 text-meta">
            <StatusDot status={s} showLabel />
            <span className="text-fg-muted tabular-nums">· {plural(byStatus.get(s) ?? 0, "department")}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
