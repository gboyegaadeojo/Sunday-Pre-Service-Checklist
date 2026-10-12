import { useEffect, useRef, useState } from "react";
import type { ChecklistCategory } from "../../../shared/types";
import { categoryProgress } from "../../lib/checklist";
import { departmentStatus, pickerLabel } from "../../lib/departmentStatus";
import type { SaveState } from "../../lib/useChecklist";
import { CheckIcon, SelectIcon } from "../ui/Icons";
import { DepartmentSheet } from "./DepartmentSheet";
import { SaveIndicator } from "./SaveIndicator";

interface Props {
  selected: ChecklistCategory;
  onSelect: (id: number) => void;
  /** The person's own departments (US-05), in order. */
  own: ChecklistCategory[];
  /** Every other department. */
  others: ChecklistCategory[];
  /** Scheduled volunteers only: "Show all departments" (it lives in the sheet). */
  showAll?: { on: boolean; onChange: (on: boolean) => void };
  /** Shown here so whether changes saved stays in view (US-06). */
  saveState: SaveState;
}

// The department picker on phones and tablets (below 1024px; design.md §3C, §5): a control, not a content card (a
// purple-tinted surface with a subtle purple border, an up-down select icon and "Change"), saying whose checklist this
// is: "Your checklist", "Helping out: not your department" with "Back to mine", or "Choose your department". Tapping it
// opens the bottom sheet. Once it scrolls up under the header, a compact one-line bar (name, count, save status,
// select icon) takes its place under the header and opens the same sheet, so the department and whether changes
// saved stay in view (US-06). The desktop sidebar (DepartmentNav) is unchanged.
export function DepartmentPicker({ selected, onSelect, own, others, showAll, saveState }: Props) {
  const [open, setOpen] = useState(false);
  const stuck = useScrolledPast();
  const status = departmentStatus(selected, own);
  const { done, total } = categoryProgress(selected);
  const label = pickerLabel(selected, status);

  return (
    <div ref={stuck.ref} className="mt-3 rounded-card border border-accent/40 bg-control lg:hidden">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 pt-2.5">
        {status.kind === "yours" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent py-0.5 pr-2.5 pl-2 text-meta font-semibold text-white">
            <CheckIcon className="size-3.5" />
            Your checklist
          </span>
        )}
        {status.kind === "helping" && (
          <span className="flex flex-wrap items-center gap-x-2 text-meta">
            <span className="text-fg">Helping out: not your department</span>
            <button
              type="button"
              onClick={() => onSelect(status.backTo.id)}
              className="-my-2 min-h-11 rounded-control px-1 font-medium text-accent-soft underline underline-offset-2"
            >
              Back to mine
            </button>
          </span>
        )}
        {status.kind === "choose" && <span className="text-meta font-medium text-fg">Choose your department</span>}
        <SaveIndicator state={saveState} compact />
      </div>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen(true)}
        className="flex min-h-14 w-full items-end gap-3 rounded-b-card px-4 pt-1 pb-3 text-left transition-colors hover:bg-accent/10"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-title leading-snug font-semibold wrap-anywhere">{selected.name}</span>
          <span className="block text-sm text-fg-muted tabular-nums">
            {done} of {total} done
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 pb-0.5 text-sm font-medium text-accent-soft">
          Change
          <SelectIcon />
        </span>
      </button>
      {/* The compact bar: a bar surface (design.md §2), primary and secondary text only. Hidden (and out of the
          keyboard order) until the card has scrolled away. */}
      <div
        inert={!stuck.past}
        aria-hidden={!stuck.past}
        className={`fixed inset-x-4 top-16 z-20 transition-[opacity,translate] duration-200 md:inset-x-6 lg:hidden ${
          stuck.past ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={label}
          onClick={() => setOpen(true)}
          className="bar flex min-h-12 w-full items-center gap-3 rounded-dialog px-4 text-left"
        >
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{selected.name}</span>
          <span className="shrink-0 text-meta text-fg-muted tabular-nums">
            {done}/{total}
          </span>
          <SaveIndicator state={saveState} compact />
          <SelectIcon className="size-4 shrink-0 text-fg-muted" />
        </button>
      </div>
      <DepartmentSheet
        open={open}
        onClose={() => setOpen(false)}
        selectedId={selected.id}
        onSelect={onSelect}
        own={own}
        others={others}
        showAll={showAll}
      />
    </div>
  );
}

/**
 * Whether the element has scrolled up under the header (56px, plus the 8px gap the bars float in). An
 * IntersectionObserver, not a scroll listener, so nothing runs while scrolling. Without one, it never reports past.
 */
function useScrolledPast() {
  const ref = useRef<HTMLDivElement>(null);
  const [past, setPast] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setPast(!entry.isIntersecting && entry.boundingClientRect.top < 64),
      { rootMargin: "-64px 0px 0px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, past };
}
