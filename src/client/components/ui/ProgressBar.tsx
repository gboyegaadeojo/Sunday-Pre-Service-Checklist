import { type Progress, percent } from "../../lib/checklist";

/** Thin progress bar. Turns green when complete; the label and counts nearby carry the meaning (design.md §2). */
export function ProgressBar({ progress, label, className = "" }: { progress: Progress; label: string; className?: string }) {
  const complete = progress.total > 0 && progress.done === progress.total;
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
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${complete ? "bg-success" : "bg-accent"}`}
        style={{ width: `${percent(progress)}%` }}
      />
    </div>
  );
}
