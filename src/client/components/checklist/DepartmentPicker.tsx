import type { ChecklistCategory } from "../../../shared/types";
import { categoryProgress } from "../../lib/checklist";
import { usePopover } from "../../lib/usePopover";
import { Chevron } from "../ui/Chevron";
import { DepartmentNav } from "./DepartmentNav";

interface Props {
  departments: ChecklistCategory[];
  selected: ChecklistCategory;
  onSelect: (id: number) => void;
}

// Mobile department menu (design.md §3C, §5): a sticky bar that opens the same list as the sidebar.
export function DepartmentPicker({ departments, selected, onSelect }: Props) {
  const { open, setOpen, close, rootRef, triggerRef } = usePopover();
  const progress = categoryProgress(selected);

  return (
    <div ref={rootRef} className="sticky top-14 z-20 -mx-4 mt-3 border-b border-line bg-bg px-4 py-2 md:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="department-menu"
        className="flex min-h-12 w-full items-center gap-3 rounded-control border border-line bg-card px-3 py-1.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-meta text-fg-muted">Department</span>
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
          className="absolute inset-x-4 top-full mt-1 max-h-[calc(100dvh-9rem)] overflow-y-auto overscroll-contain rounded-card border border-line bg-panel p-1.5"
        >
          <DepartmentNav
            departments={departments}
            selectedId={selected.id}
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
