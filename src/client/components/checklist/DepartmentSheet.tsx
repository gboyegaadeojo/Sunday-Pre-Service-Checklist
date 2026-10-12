import { useEffect, useId, useRef } from "react";
import type { ChecklistCategory } from "../../../shared/types";
import { categoryProgress } from "../../lib/checklist";
import { CheckIcon } from "../ui/Icons";
import { Switch } from "../ui/Switch";

interface Props {
  open: boolean;
  onClose: () => void;
  selectedId: number;
  onSelect: (id: number) => void;
  /** The person's own departments (US-05), listed first. */
  own: ChecklistCategory[];
  /** Every other department; listed when shown (always, unless only their own are showing). */
  others: ChecklistCategory[];
  /** Scheduled volunteers only: "Show all departments", remembered for the day. */
  showAll?: { on: boolean; onChange: (on: boolean) => void };
}

// The department choice on phones and tablets (design.md §3C, §5): a bottom sheet on the native <dialog> (modal,
// focus kept inside, Escape closes, focus returns to the button that opened it). "Your departments" first, then
// "Other departments", 48px rows with "X of Y done" and a check mark on the one showing; "Show all departments" sits
// here. Solid, like every list (design.md §2, Surfaces), over the dimmed page.
export function DepartmentSheet({ open, onClose, selectedId, onSelect, own, others, showAll }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const othersShown = !showAll || showAll.on;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>("[aria-current=true]")?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const rows = (departments: ChecklistCategory[]) => (
    <ul className="space-y-0.5">
      {departments.map((d) => {
        const current = d.id === selectedId;
        const { done, total } = categoryProgress(d);
        return (
          <li key={d.id}>
            <button
              type="button"
              aria-current={current ? "true" : undefined}
              onClick={() => {
                onSelect(d.id);
                onClose();
              }}
              className={`flex min-h-12 w-full items-center gap-3 rounded-control px-3 py-2 text-left transition-colors outline-offset-[-2px] ${
                current ? "bg-control font-semibold text-fg" : "text-fg hover:bg-hover"
              }`}
            >
              <span className="grid size-5 shrink-0 place-items-center">{current && <CheckIcon className="size-4 text-accent-soft" />}</span>
              <span className="min-w-0 flex-1 text-sm leading-snug wrap-anywhere">{d.name}</span>
              <span className="shrink-0 text-meta font-normal text-fg-muted tabular-nums">
                {done} of {total} done
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
  const group = (title: string, departments: ChecklistCategory[]) => (
    <section aria-label={title} className="mt-3">
      <h3 className="mb-1 px-3 text-meta font-medium text-fg-muted">{title}</h3>
      {rows(departments)}
    </section>
  );

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the click is a tap on the dimmed page outside the sheet; the keyboard equivalent is Escape (the dialog's cancel event, handled below)
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // a tap on the dimmed page outside the sheet
      }}
      className="sheet inset-x-0 top-auto bottom-0 mx-auto mb-0 max-h-[85dvh] w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-dialog border border-b-0 border-line bg-panel p-0 pb-[max(1rem,env(safe-area-inset-bottom))] text-fg shadow-[var(--glass-shadow)] backdrop:bg-bg/80"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-panel px-4 py-2">
        <h2 id={titleId} className="text-base font-semibold">
          Choose a department
        </h2>
        <button type="button" onClick={onClose} className="min-h-11 rounded-control px-3 text-sm font-medium text-accent-soft hover:bg-hover">
          Done
        </button>
      </div>
      <div className="px-2 pb-2">
        {own.length > 0 && group("Your departments", own)}
        {showAll && (
          <div className="mt-3 px-1">
            <Switch label="Show all departments" on={showAll.on} onToggle={() => showAll.onChange(!showAll.on)} />
          </div>
        )}
        {othersShown && others.length > 0 && group(own.length > 0 ? "Other departments" : "Departments", others)}
      </div>
    </dialog>
  );
}
