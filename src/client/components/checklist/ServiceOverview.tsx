import type { ChecklistResponse } from "../../../shared/types";
import { checklistProgress, percent } from "../../lib/checklist";
import { formatServiceDate } from "../../lib/format";
import type { SaveState } from "../../lib/useChecklist";
import { Card } from "../ui/Card";
import { ProgressBar } from "../ui/ProgressBar";
import { SaveIndicator } from "./SaveIndicator";

// Service overview (design.md §3B): which service, how much is done, and whether changes are saved.
// Every number comes from the checklist data.
export function ServiceOverview({ checklist, saveState }: { checklist: ChecklistResponse; saveState: SaveState }) {
  const { service } = checklist;
  const progress = checklistProgress(checklist);

  return (
    <Card role="region" aria-label="Service overview" className="px-4 py-3 md:px-5 md:py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1">
        <p className="min-w-0">
          <span className="block text-meta text-fg-muted">
            {service.isToday ? "Today's service" : "Upcoming service"} · {checklist.list.name}
          </span>
          <span className="block text-base font-semibold">{formatServiceDate(service.date)}</span>
        </p>
        <SaveIndicator state={saveState} />
      </div>

      {progress.total > 0 && (
        <>
          <div className="mt-3 flex items-center gap-3">
            <ProgressBar progress={progress} label="Overall progress" className="flex-1" />
            <span className="w-10 shrink-0 text-right text-meta font-medium tabular-nums">{percent(progress)}%</span>
          </div>
          <p className="mt-1.5 text-meta text-fg-muted tabular-nums">
            <span className="font-medium text-fg">
              {progress.done} of {progress.total}
            </span>{" "}
            tasks done · {progress.total - progress.done} remaining
          </p>
        </>
      )}

      {!service.published && (
        <p className="mt-2 text-meta text-fg-muted">
          No service is published in Planning Center yet — your checklist is ready when you are.
        </p>
      )}
    </Card>
  );
}
