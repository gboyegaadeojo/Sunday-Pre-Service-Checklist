import type { ProgressStatus } from "../../lib/checklist";

const STYLES: Record<Exclude<ProgressStatus, "empty">, { color: string; label: string }> = {
  complete: { color: "bg-success", label: "Complete" },
  in_progress: { color: "bg-warning", label: "In progress" },
  not_started: { color: "bg-idle", label: "Not started" },
};

/**
 * Status colour dot with its label. The label is visually hidden by default because a count is always
 * shown next to it; pass `showLabel` where the dot stands without one. Never colour alone (design.md §2).
 */
export function StatusDot({ status, showLabel = false }: { status: ProgressStatus; showLabel?: boolean }) {
  if (status === "empty") return null;
  const { color, label } = STYLES[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${color}`} />
      <span className={showLabel ? "text-meta text-fg-muted" : "sr-only"}>{label}</span>
    </span>
  );
}
