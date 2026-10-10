import type { ProgressStatus } from "../../lib/checklist";

const STATUS_TEXT: Record<ProgressStatus, { label: string; tone: string }> = {
  complete: { label: "Complete", tone: "text-success" },
  in_progress: { label: "In progress", tone: "text-warning" },
  not_started: { label: "Not started", tone: "text-fg-muted" },
  empty: { label: "No tasks", tone: "text-fg-muted" },
};

/** A department's status in words, coloured to match its bar (design.md §6: never colour alone). */
export function StatusText({ status, className = "" }: { status: ProgressStatus; className?: string }) {
  const { label, tone } = STATUS_TEXT[status];
  return <span className={`shrink-0 text-meta font-medium ${tone} ${className}`}>{label}</span>;
}
