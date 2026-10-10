import type { ChecklistCategory, ChecklistResponse } from "../../../shared/types";
import { categoryProgress, checklistProgress, percent } from "../../lib/checklist";
import { formatServiceDate } from "../../lib/format";
import type { SaveState } from "../../lib/useChecklist";
import { Card } from "../ui/Card";
import { ProgressBar } from "../ui/ProgressBar";
import { notPublishedNote } from "./DepartmentScope";
import { SaveIndicator } from "./SaveIndicator";

interface Props {
  checklist: ChecklistResponse;
  saveState: SaveState;
  /**
   * A scheduled volunteer's own departments, while the checklist shows only those (US-05): their progress leads, and
   * the whole service's follows on a smaller line. Omitted for everyone else, who see the whole service's progress.
   */
  own?: ChecklistCategory[];
}

// Service overview (design.md §3B): which service, how much is done, and whether changes are saved.
// Every number comes from the checklist data.
export function ServiceOverview({ checklist, saveState, own }: Props) {
  const { service } = checklist;
  const whole = checklistProgress(checklist);
  const mine = own?.length
    ? own.map(categoryProgress).reduce((a, p) => ({ done: a.done + p.done, total: a.total + p.total }), { done: 0, total: 0 })
    : null;
  const lead = mine ?? whole;

  return (
    <Card role="region" aria-label="Service overview" className="px-4 py-2.5 md:px-5 md:py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1">
        <p className="min-w-0">
          <span className="block text-meta text-fg-muted">
            {service.isToday ? "Today's service" : "Upcoming service"} · {checklist.list.name}
          </span>
          <span className="block text-base font-semibold">{formatServiceDate(service.date)}</span>
        </p>
        <SaveIndicator state={saveState} />
      </div>

      {lead.total > 0 && (
        <>
          <div className="mt-2 flex items-center gap-3 md:mt-3">
            <ProgressBar progress={lead} label={mine ? "Your progress" : "Overall progress"} className="flex-1" />
            <span className="w-10 shrink-0 text-right text-meta font-medium tabular-nums">{percent(lead)}%</span>
          </div>
          {mine && own ? (
            <>
              <p className="mt-1.5 text-sm tabular-nums wrap-anywhere">
                <span className="font-medium">{own.map((d) => d.name).join(", ")}:</span>{" "}
                <span className="font-medium text-fg">
                  {mine.done} of {mine.total}
                </span>{" "}
                <span className="text-fg-muted">done · {mine.total - mine.done} remaining</span>
              </p>
              <p className="mt-0.5 text-meta text-fg-muted tabular-nums">
                Whole service: {whole.done} of {whole.total} done · {whole.total - whole.done} remaining
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-meta text-fg-muted tabular-nums">
              <span className="font-medium text-fg">
                {whole.done} of {whole.total}
              </span>{" "}
              tasks done · {whole.total - whole.done} remaining
            </p>
          )}
        </>
      )}

      {/* Not shown while the schedule can't be loaded: "not published" might not be true (US-04a). Someone choosing
          their department gets it in the note under this card instead, with "Choose your department below." */}
      {!service.published && checklist.view.note !== "schedule_unavailable" && checklist.view.mode !== "choose" && (
        <p className="mt-2 text-meta text-fg-muted">{notPublishedNote(checklist.view)}</p>
      )}
    </Card>
  );
}
