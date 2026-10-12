import { useState } from "react";
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
// opens the bottom sheet. The desktop sidebar (DepartmentNav) is unchanged.
export function DepartmentPicker({ selected, onSelect, own, others, showAll, saveState }: Props) {
  const [open, setOpen] = useState(false);
  const status = departmentStatus(selected, own);
  const { done, total } = categoryProgress(selected);

  return (
    <div className="mt-3 rounded-card border border-accent/40 bg-control lg:hidden">
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
        aria-label={pickerLabel(selected, status)}
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
