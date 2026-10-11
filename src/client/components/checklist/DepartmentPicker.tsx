import type { ChecklistCategory } from "../../../shared/types";
import { categoryProgress } from "../../lib/checklist";
import type { SaveState } from "../../lib/useChecklist";
import { usePopover } from "../../lib/usePopover";
import { Chevron } from "../ui/Chevron";
import { DepartmentNav } from "./DepartmentNav";
import { SaveIndicator } from "./SaveIndicator";

interface Props {
  departments: ChecklistCategory[];
  selected: ChecklistCategory;
  onSelect: (id: number) => void;
  ownIds?: ReadonlySet<number>;
  /** Shown in the bar, so whether changes saved stays in view while scrolling (US-06). */
  saveState: SaveState;
}

// Mobile department menu (design.md §3C, §5): a sticky bar that opens the same list as the sidebar, and keeps the
// save status in view. It floats under the header as a rounded bar surface (design.md §2, Surfaces): the checklist
// scrolls under it, so only primary and secondary text on it. The list it opens is solid, like every list.
export function DepartmentPicker({ departments, selected, onSelect, ownIds, saveState }: Props) {
  const { open, setOpen, close, rootRef, triggerRef } = usePopover();
  const progress = categoryProgress(selected);

  return (
    <div ref={rootRef} className="bar sticky top-16 z-20 mt-3 rounded-dialog p-1 md:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="department-menu"
        className="flex min-h-12 w-full items-center gap-3 rounded-[1.25rem] px-3 py-1.5 text-left transition-colors hover:bg-fg/5"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="text-meta text-fg-muted">Department</span>
            <SaveIndicator state={saveState} compact />
          </span>
          <span className="block text-sm leading-snug font-semibold wrap-anywhere">{selected.name}</span>
        </span>
        <span className="shrink-0 text-meta text-fg-muted tabular-nums">
          {progress.done}/{progress.total}
          <span className="sr-only"> tasks done</span>
        </span>
        <Chevron open={open} />
      </button>

      {open && (
        <nav
          id="department-menu"
          aria-label="Departments"
          className="absolute inset-x-0 top-full mt-1.5 max-h-[calc(100dvh-9rem)] overflow-y-auto overscroll-contain rounded-glass border border-line bg-panel p-1.5 shadow-[var(--glass-shadow)]"
        >
          <DepartmentNav
            departments={departments}
            selectedId={selected.id}
            ownIds={ownIds}
            onSelect={(id) => {
              onSelect(id);
              close();
            }}
          />
        </nav>
      )}
    </div>
  );
}
