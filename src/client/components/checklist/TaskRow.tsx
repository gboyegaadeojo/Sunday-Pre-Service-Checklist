import type { ChecklistTask } from "../../../shared/types";

// Read-only in Stage 1: no check-offs exist yet, so the row has no checkbox and is not interactive.
// Stage 3 makes the whole row a 48px checkbox target (design.md §3E).
export function TaskRow({ task }: { task: ChecklistTask }) {
  return (
    <li className="flex min-h-12 items-start gap-3 px-4 py-3">
      <span aria-hidden="true" className="flex h-[1.375rem] w-6 shrink-0 items-center">
        <span className="size-1.5 rounded-full bg-idle" />
      </span>
      <span className="max-w-[72ch] text-task text-fg">{task.text}</span>
    </li>
  );
}
