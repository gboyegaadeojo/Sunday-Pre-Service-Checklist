import type { ChecklistCategory } from "../../../shared/types";
import { countCategoryTasks, plural } from "../../lib/checklist";

interface Props {
  departments: ChecklistCategory[];
  selectedId: number;
  onSelect: (id: number) => void;
}

// Department list shared by the desktop sidebar and the mobile picker (design.md §3C).
// Completed counts and status are added in Stage 3.
export function DepartmentNav({ departments, selectedId, onSelect }: Props) {
  return (
    <ul className="space-y-1">
      {departments.map((d) => {
        const selected = d.id === selectedId;
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
              <span className="min-w-0 flex-1 leading-snug wrap-anywhere">{d.name}</span>
              <span className="shrink-0 text-meta font-normal text-fg-muted tabular-nums">
                {plural(countCategoryTasks(d), "task")}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
