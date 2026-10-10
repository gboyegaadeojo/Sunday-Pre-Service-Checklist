import type { ChecklistTask } from "../../../shared/types";
import { formatTime } from "../../lib/format";
import { AlertIcon, CheckIcon } from "../ui/Icons";

interface Props {
  task: ChecklistTask;
  timeZone: string;
  saving: boolean;
  /** The last save of this task failed (US-06): says so until a save of it succeeds. */
  failed: boolean;
  onToggle: () => void;
}

// A task as a native checkbox: the whole row is the label, so it is one 48px+ tap target
// (US-06, design.md §3E) and keyboard/screen-reader behaviour comes from the platform.
export function TaskRow({ task, timeZone, saving, failed, onToggle }: Props) {
  const checked = task.checkoff !== null;
  return (
    <li>
      <label
        aria-busy={saving}
        className="flex min-h-12 cursor-pointer items-start gap-3 px-4 py-3 transition-colors select-none hover:bg-hover kbd-focus-within:outline-2 kbd-focus-within:-outline-offset-2 kbd-focus-within:outline-accent-soft"
      >
        <input type="checkbox" className="sr-only" checked={checked} onChange={onToggle} />
        <span aria-hidden="true" className="flex h-[1.375rem] w-6 shrink-0 items-center">
          <span
            className={`grid size-5 place-items-center rounded-[5px] border-2 transition-colors ${
              checked ? "border-success bg-success text-bg" : failed ? "border-danger" : "border-fg-muted/70 bg-transparent"
            }`}
          >
            {checked && <CheckIcon className="size-3.5" />}
          </span>
        </span>
        <span className="min-w-0 max-w-[72ch]">
          <span className={`block text-task wrap-anywhere ${checked ? "text-fg-muted" : "text-fg"}`}>{task.text}</span>
          {failed && !saving && (
            <span className="mt-0.5 flex items-center gap-1.5 text-meta text-danger">
              <AlertIcon className="size-3.5 shrink-0" />
              Not saved. Tap to try again.
            </span>
          )}
          {task.checkoff && !failed && (
            <span className="mt-0.5 block text-meta text-fg-muted">
              {task.checkoff.by} · {formatTime(task.checkoff.at, timeZone)}
            </span>
          )}
        </span>
      </label>
    </li>
  );
}
