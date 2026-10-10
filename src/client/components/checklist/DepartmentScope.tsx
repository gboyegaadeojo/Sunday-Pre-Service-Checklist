import type { ChecklistCategory, ChecklistView } from "../../../shared/types";
import { InfoIcon } from "../ui/Icons";
import { Switch } from "../ui/Switch";

interface Props {
  view: ChecklistView;
  /** The person's own departments, in order. */
  own: ChecklistCategory[];
  showAll: boolean;
  onShowAllChange: (on: boolean) => void;
}

const NOTE: Record<NonNullable<ChecklistView["note"]>, string> = {
  not_scheduled: "You're not on the schedule for this service, but you can still help. Choose your department.",
  not_linked: "Your position isn't linked to a checklist department yet, so choose yours below.",
};

// Which departments the checklist is showing, and why (US-05, US-02; design.md §3C). Scheduled volunteers see their
// own department(s) with "Show all departments"; someone choosing is told why. Nothing for everyone else.
export function DepartmentScope({ view, own, showAll, onShowAllChange }: Props) {
  if (view.mode === "own") {
    const names = own.map((d) => d.name).join(", ");
    return (
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-card border border-line bg-surface px-4 py-2">
        <p className="min-w-0 text-sm wrap-anywhere">
          <span className="text-fg-muted">
            {showAll ? "Your " : "Showing your "}department{own.length === 1 ? "" : "s"}:{" "}
          </span>
          <span className="font-medium">{names}</span>
          {showAll && <span className="text-fg-muted"> first, then the rest</span>}
        </p>
        <Switch label="Show all departments" on={showAll} onToggle={() => onShowAllChange(!showAll)} />
      </div>
    );
  }
  if (view.mode === "choose" && view.note) {
    return (
      <div role="note" className="mt-3 flex gap-3 rounded-card border border-accent-soft/30 bg-accent/10 px-4 py-3 text-sm">
        <InfoIcon className="mt-0.5 size-4 shrink-0 text-accent-soft" />
        <p className="min-w-0">{NOTE[view.note]}</p>
      </div>
    );
  }
  return null;
}
