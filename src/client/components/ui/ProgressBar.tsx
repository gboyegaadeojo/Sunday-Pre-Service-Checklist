import { type Progress, percent, progressStatus } from "../../lib/checklist";

const STATUS_FILL = { complete: "bg-success", in_progress: "bg-warning", not_started: "bg-idle", empty: "bg-idle" } as const;

/**
 * Thin progress bar; the label and counts nearby carry the meaning (design.md §2).
 * tone "accent" (the checklist): purple, green when complete. tone "status" (Progress, design.md §6): coloured by
 * status, green complete, yellow in progress, grey not started.
 */
export function ProgressBar({
  progress,
  label,
  className = "",
  tone = "accent",
}: {
  progress: Progress;
  label: string;
  className?: string;
  tone?: "accent" | "status";
}) {
  const complete = progress.total > 0 && progress.done === progress.total;
  const fill = tone === "status" ? STATUS_FILL[progressStatus(progress)] : complete ? "bg-success" : "bg-accent";
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={progress.total}
      aria-valuenow={progress.done}
      aria-valuetext={`${progress.done} of ${progress.total} tasks done`}
      className={`h-1.5 overflow-hidden rounded-full bg-line ${className}`}
    >
      <div className={`h-full rounded-full transition-[width] duration-300 ${fill}`} style={{ width: `${percent(progress)}%` }} />
    </div>
  );
}
