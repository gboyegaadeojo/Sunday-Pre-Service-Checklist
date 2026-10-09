import { useEffect } from "react";
import { AlertIcon } from "./Icons";

/**
 * A brief, dismissible error shown at the bottom of the screen (design.md §8: concise, non-disruptive).
 * Hides itself after a few seconds. Used for failed saves, never for routine success.
 */
export function ErrorFeedback({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, 7000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div aria-live="assertive" className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4">
      {message && (
        <div
          role="alert"
          className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-card border border-danger/50 bg-panel p-3 text-sm"
        >
          <AlertIcon className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="flex-1 text-fg">{message}</p>
          <button
            type="button"
            onClick={onDismiss}
            className="-m-1.5 min-h-11 shrink-0 rounded-control px-3 text-meta text-fg-muted hover:bg-hover hover:text-fg"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
