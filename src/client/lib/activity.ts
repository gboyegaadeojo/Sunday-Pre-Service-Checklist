import type { ActivityEvent } from "../../shared/types";

// Wording shared by the Activity view and service history (Stage 5d.3) for the check-off log (US-07a).

export const ACTION: Record<ActivityEvent["action"], { label: string; tone: string }> = {
  check: { label: "Checked", tone: "text-success" },
  uncheck: { label: "Unchecked", tone: "text-fg" },
  reset: { label: "Reset checklist", tone: "text-danger" },
  undo_reset: { label: "Undid reset", tone: "text-warning" },
};

export const OUTCOME: Record<Exclude<ActivityEvent["outcome"], "applied">, string> = {
  no_change: "No change",
  not_found: "Task not on checklist",
  service_changed: "Service had ended",
};

/** "9:42:10 AM" today in the church's time zone; "Oct 4, 9:42 AM" for older entries (edits can be from any day). */
export function formatWhen(iso: string, timeZone: string, today: string) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(iso));
  const options: Intl.DateTimeFormatOptions =
    day === today ? { hour: "numeric", minute: "2-digit", second: "2-digit" } : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone }).format(new Date(iso));
}

export const short = (id: string | null) => (id ? id.slice(0, 8) : "—");

export function describeCheckoff(e: ActivityEvent): string {
  if (e.action === "reset") return `${e.affected ?? 0} check-off${e.affected === 1 ? "" : "s"} cleared`;
  if (e.action === "undo_reset") return `${e.affected ?? 0} check-off${e.affected === 1 ? "" : "s"} restored`;
  return e.taskText ?? `Task #${e.taskId} (no longer exists)`;
}
