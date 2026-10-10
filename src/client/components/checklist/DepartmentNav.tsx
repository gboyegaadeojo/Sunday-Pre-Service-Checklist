import type { ChecklistCategory } from "../../../shared/types";
import { categoryProgress, progressStatus } from "../../lib/checklist";
import { StatusDot } from "../ui/StatusDot";
import { YoursBadge } from "./YoursBadge";

interface Props {
  departments: ChecklistCategory[];
  selectedId: number;
  onSelect: (id: number) => void;
  /** The person's own departments (US-05), marked "Yours". */
  ownIds?: ReadonlySet<number>;
}

// Department list shared by the desktop sidebar and the mobile picker (design.md §3C): each department a card-style
// button with its name and "X of Y tasks" (a status dot plus a screen-reader label; the count is always visible).
// The selected one is outlined in purple.
export function DepartmentNav({ departments, selectedId, onSelect, ownIds }: Props) {
  return (
    <ul className="space-y-2">
      {departments.map((d) => {
        const selected = d.id === selectedId;
        const progress = categoryProgress(d);
        return (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => onSelect(d.id)}
              aria-current={selected ? "true" : undefined}
              className={`flex min-h-12 w-full flex-col rounded-card border px-4 py-3 text-left transition-colors ${
                selected ? "border-accent bg-accent/10" : "border-line bg-card hover:bg-hover"
              }`}
            >
              <span className="min-w-0 text-sm leading-snug font-semibold text-fg wrap-anywhere">
                {d.name}
                {ownIds?.has(d.id) && <YoursBadge />}
              </span>
              <span className="mt-1 flex items-center gap-2 text-meta text-fg-muted tabular-nums">
                <StatusDot status={progressStatus(progress)} />
                {progress.done} of {progress.total} tasks
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
