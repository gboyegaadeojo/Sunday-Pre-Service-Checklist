import { type ReactNode, useId, useState } from "react";
import type { AdminCategory } from "../../../shared/types";
import { plural } from "../../lib/checklist";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import type { MoveRequest } from "./editor-context";

interface Props {
  request: MoveRequest | null;
  categories: AdminCategory[];
  busy: boolean;
  error: string | null;
  /** The chosen section (for a task) or department (for a section). */
  onMove: (destinationId: number) => void;
  onCancel: () => void;
}

/**
 * "Move to…" (US-12a, US-13): a task picks a department, then a section; a section picks a department.
 * Radio rows and a native select, so it works by touch on a 375px phone and by keyboard. The parent
 * remounts it per request (key), so each opening starts fresh.
 */
export function MoveDialog({ request, categories, busy, error, onMove, onCancel }: Props) {
  const [departmentId, setDepartmentId] = useState(request?.categoryId ?? null);
  const [destination, setDestination] = useState<number | null>(null);
  const name = useId();

  const isTask = request?.kind === "task";
  const department = categories.find((c) => c.id === departmentId);
  const movingSection = request?.kind === "section" ? findSection(categories, request.id) : undefined;

  return (
    <ConfirmDialog
      open={request !== null}
      title={isTask ? "Move task" : "Move section"}
      confirmLabel={isTask ? "Move task" : "Move section"}
      busy={busy}
      confirmDisabled={destination === null}
      error={error}
      onConfirm={() => destination !== null && onMove(destination)}
      onCancel={onCancel}
    >
      {request && (
        <>
          <p className="font-medium text-fg wrap-anywhere">“{request.name}”</p>
          <p>
            {isTask
              ? "It goes to the end of the section you choose."
              : `It moves with its ${plural(movingSection?.tasks.length ?? 0, "task")} to the end of the department you choose.`}{" "}
            Check-offs for this service stay with it, and past services keep where it was.
          </p>

          {isTask ? (
            <div className="space-y-3 pt-1">
              <div>
                <label htmlFor={`${name}-department`} className="mb-1 block text-meta font-medium text-fg-muted">
                  Department
                </label>
                <select
                  id={`${name}-department`}
                  value={departmentId ?? ""}
                  onChange={(e) => {
                    setDepartmentId(Number(e.target.value));
                    setDestination(null);
                  }}
                  className="min-h-11 w-full rounded-control border border-line bg-bg px-3 text-base text-fg focus-visible:border-accent-soft"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.id === request.categoryId ? " (current)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <fieldset className="space-y-2">
                <legend className="mb-1 text-meta font-medium text-fg-muted">Section</legend>
                {department && department.sections.length === 0 && (
                  <p className="text-meta">This department has no sections yet. Add one first, then move the task.</p>
                )}
                {department?.sections.map((s, i) => (
                  <Choice
                    key={s.id}
                    name={`${name}-section`}
                    checked={destination === s.id}
                    disabled={s.id === request.sectionId}
                    note={s.id === request.sectionId ? "Current" : undefined}
                    onChange={() => setDestination(s.id)}
                  >
                    <span className="mr-1.5 text-fg-muted tabular-nums">{i + 1}.</span>
                    {s.name}
                  </Choice>
                ))}
              </fieldset>
            </div>
          ) : (
            <fieldset className="space-y-2 pt-1">
              <legend className="mb-1 text-meta font-medium text-fg-muted">Department</legend>
              {categories.map((c) => (
                <Choice
                  key={c.id}
                  name={`${name}-department`}
                  checked={destination === c.id}
                  disabled={c.id === request.categoryId}
                  note={c.id === request.categoryId ? "Current" : undefined}
                  onChange={() => setDestination(c.id)}
                >
                  {c.name}
                </Choice>
              ))}
            </fieldset>
          )}
        </>
      )}
    </ConfirmDialog>
  );
}

const findSection = (categories: AdminCategory[], id: number) => categories.flatMap((c) => c.sections).find((s) => s.id === id);

interface ChoiceProps {
  name: string;
  checked: boolean;
  disabled: boolean;
  note?: string;
  onChange: () => void;
  children: ReactNode;
}

/** A full-width radio row, 48px tall. */
function Choice({ name, checked, disabled, note, onChange, children }: ChoiceProps) {
  return (
    <label
      className={`flex min-h-12 items-center gap-3 rounded-control border px-3 py-2 transition-colors ${
        checked ? "border-accent-soft bg-accent/10" : "border-line"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-hover"}`}
    >
      <input type="radio" name={name} checked={checked} disabled={disabled} onChange={onChange} className="size-4 shrink-0 accent-accent" />
      <span className="min-w-0 flex-1 text-sm text-fg wrap-anywhere">{children}</span>
      {note && <span className="shrink-0 text-meta text-fg-muted">{note}</span>}
    </label>
  );
}
