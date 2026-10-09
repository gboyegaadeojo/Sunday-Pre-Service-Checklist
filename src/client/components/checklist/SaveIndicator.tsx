import type { SaveState } from "../../lib/useChecklist";
import { AlertIcon, CheckIcon } from "../ui/Icons";

// Subtle "are my changes saved?" status (design.md §3, §8). Never claims "saved" unless the server accepted it.
export function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <p role="status" className="flex min-h-5 items-center gap-1.5 text-meta">
      {state === "saving" && (
        <>
          <span aria-hidden="true" className="size-3 rounded-full border-2 border-line border-t-accent-soft motion-safe:animate-spin" />
          <span className="text-fg-muted">Saving…</span>
        </>
      )}
      {state === "saved" && (
        <>
          <CheckIcon className="size-3.5 text-success" />
          <span className="text-fg-muted">All changes saved</span>
        </>
      )}
      {state === "failed" && (
        <>
          <AlertIcon className="size-3.5 text-danger" />
          <span className="text-danger">Last change not saved</span>
        </>
      )}
    </p>
  );
}
