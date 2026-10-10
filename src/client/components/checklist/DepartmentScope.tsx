import type { ChecklistCategory, ChecklistView } from "../../../shared/types";
import { AlertIcon, InfoIcon } from "../ui/Icons";
import { Switch } from "../ui/Switch";

interface Props {
  view: ChecklistView;
  /** The person's own departments, in order. */
  own: ChecklistCategory[];
  showAll: boolean;
  onShowAllChange: (on: boolean) => void;
  /** The current service has a plan in the schedule (US-05: "No service is published …" otherwise). */
  published: boolean;
}

const NOTE: Record<Exclude<ChecklistView["note"], "schedule_unavailable" | null>, string> = {
  not_scheduled: "You're not on the schedule for this service, but you can still help. Choose your department.",
  not_linked: "Your position isn't linked to a checklist department yet, so choose yours below.",
};

/** US-05's note when no plan is published, naming the schedule source (Planning Center today; requirements C22). */
export const notPublishedNote = (view: ChecklistView) =>
  `No service is published in ${view.source ?? "the schedule"} yet — your checklist is ready when you are.`;

// Which departments the checklist is showing, and why (US-05, US-02; design.md §3C). Scheduled volunteers see their
// own department(s) with "Show all departments"; someone choosing is told why; everyone is told when the schedule
// couldn't be loaded. Nothing otherwise.
export function DepartmentScope({ view, own, showAll, onShowAllChange, published }: Props) {
  // The schedule couldn't be loaded (US-04a): everyone picks their department; check-offs work as usual.
  if (view.note === "schedule_unavailable") {
    return (
      <div role="status" className="mt-3 flex gap-3 rounded-card border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
        <AlertIcon className="mt-0.5 size-4 shrink-0 text-warning" />
        <p className="min-w-0">
          We couldn't load your schedule from {view.source ?? "the schedule"}. Please select your department.
        </p>
      </div>
    );
  }
  if (view.mode === "own") {
    // One slim row, so the tasks start high on a phone (design.md §5). Phones get the short form: the sticky
    // department bar just below names the department.
    const names = own.map((d) => d.name).join(", ");
    return (
      <div className="mt-3 flex items-center justify-between gap-3 rounded-card border border-line bg-surface py-1.5 pr-1.5 pl-4">
        <p className="min-w-0 text-sm wrap-anywhere">
          <span className="text-fg-muted sm:hidden">{showAll ? "Yours first, then the rest" : "Showing only yours"}</span>
          <span className="hidden sm:inline">
            <span className="text-fg-muted">Your department{own.length === 1 ? "" : "s"}: </span>
            <span className="font-medium">{names}</span>
            {showAll && <span className="text-fg-muted"> first, then the rest</span>}
          </span>
        </p>
        <Switch label="Show all departments" shortLabel="Show all" on={showAll} onToggle={() => onShowAllChange(!showAll)} />
      </div>
    );
  }
  // Choosing: say why. With no plan published, the schedule can't say who's where, so say that and ask them to choose
  // (US-05), rather than leaving them on the first department.
  const message =
    view.mode === "choose" && view.note ? NOTE[view.note] : view.mode === "choose" && !published ? `${notPublishedNote(view)} Choose your department below.` : null;
  if (message) {
    return (
      <div role="note" className="mt-3 flex gap-3 rounded-card border border-accent-soft/30 bg-accent/10 px-4 py-3 text-sm">
        <InfoIcon className="mt-0.5 size-4 shrink-0 text-accent-soft" />
        <p className="min-w-0">{message}</p>
      </div>
    );
  }
  return null;
}
