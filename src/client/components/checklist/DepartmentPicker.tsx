import { useEffect, useRef, useState } from "react";
import type { ChecklistCategory } from "../../../shared/types";
import { countCategoryTasks, plural } from "../../lib/checklist";
import { Chevron } from "../ui/Chevron";
import { DepartmentNav } from "./DepartmentNav";

interface Props {
  departments: ChecklistCategory[];
  selected: ChecklistCategory;
  onSelect: (id: number) => void;
}

// Mobile department menu (design.md §3C, §5): a sticky bar that opens the same list as the sidebar.
export function DepartmentPicker({ departments, selected, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="sticky top-14 z-20 -mx-4 mt-3 border-b border-line bg-bg px-4 py-2 md:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="department-menu"
        className="flex min-h-12 w-full items-center gap-3 rounded-control border border-line bg-card px-3 py-1.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-meta text-fg-muted">Department</span>
          <span className="block text-sm leading-snug font-semibold">{selected.name}</span>
        </span>
        <span className="shrink-0 text-meta text-fg-muted tabular-nums">
          {plural(countCategoryTasks(selected), "task")}
        </span>
        <Chevron open={open} />
      </button>

      {open && (
        <nav
          id="department-menu"
          aria-label="Departments"
          className="absolute inset-x-4 top-full mt-1 rounded-card border border-line bg-panel p-1.5"
        >
          <DepartmentNav
            departments={departments}
            selectedId={selected.id}
            onSelect={(id) => {
              onSelect(id);
              setOpen(false);
              buttonRef.current?.focus();
            }}
          />
        </nav>
      )}
    </div>
  );
}
