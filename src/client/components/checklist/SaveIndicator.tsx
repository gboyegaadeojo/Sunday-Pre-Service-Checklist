import type { SaveState } from "../../lib/useChecklist";
import { AlertIcon, CheckIcon } from "../ui/Icons";

const LABELS: Record<Exclude<SaveState, "idle">, { full: string; short: string }> = {
  saving: { full: "Saving…", short: "Saving…" },
  saved: { full: "All changes saved", short: "Saved" },
  failed: { full: "Last change not saved", short: "Not saved" },
};

/**
 * Subtle "are my changes saved?" status (design.md §3, §8). Never claims "saved" unless the server accepted it.
 * `compact`: the short form that stays in view while scrolling (the sticky department bar on phones, the sidebar
 * on wider screens; US-06). It repeats the overview's status visually only, so screen readers hear each change once.
 */
export function SaveIndicator({ state, compact = false }: { state: SaveState; compact?: boolean }) {
  const label = state === "idle" ? null : LABELS[state][compact ? "short" : "full"];
  const content = (
    <>
      {state === "saving" && (
        <span aria-hidden="true" className="size-3 rounded-full border-2 border-line border-t-accent-soft motion-safe:animate-spin" />
      )}
      {state === "saved" && <CheckIcon className="size-3.5 text-success" />}
      {state === "failed" && <AlertIcon className="size-3.5 text-danger" />}
      {label && <span className={state === "failed" ? "text-danger" : "text-fg-muted"}>{label}</span>}
    </>
  );
  // A span when compact: it sits inside the department bar's button.
  return compact ? (
    <span aria-hidden="true" className="flex items-center gap-1.5 text-meta whitespace-nowrap">
      {content}
    </span>
  ) : (
    <p role="status" className="flex min-h-5 items-center gap-1.5 text-meta">
      {content}
    </p>
  );
}
