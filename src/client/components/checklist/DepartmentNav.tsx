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

// Department list shared by the desktop sidebar and the mobile picker (design.md §3C):
// name, done/total, and status (dot plus a screen-reader label; the count is always visible).
export function DepartmentNav({ departments, selectedId, onSelect, ownIds }: Props) {
  return (
    <ul className="space-y-1">
      {departments.map((d) => {
        const selected = d.id === selectedId;
        const progress = categoryProgress(d);
        return (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => onSelect(d.id)}
              aria-current={selected ? "true" : undefined}
              className={`relative flex min-h-12 w-full items-center gap-3 rounded-control py-2 pr-3 pl-4 text-left text-sm transition-colors ${
                selected ? "bg-hover font-semibold text-fg" : "text-fg-muted hover:bg-hover hover:text-fg"
              }`}
            >
              {selected && (
                <span aria-hidden="true" className="absolute inset-y-2.5 left-0 w-1 rounded-full bg-accent" />
              )}
              <span className="min-w-0 flex-1 leading-snug wrap-anywhere">
                {d.name}
                {ownIds?.has(d.id) && <YoursBadge />}
              </span>
              <span className="flex shrink-0 items-center gap-2 text-meta font-normal text-fg-muted tabular-nums">
                <StatusDot status={progressStatus(progress)} />
                {progress.done}/{progress.total}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
