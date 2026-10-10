import { useEffect } from "react";
import { AlertIcon, CheckIcon } from "./Icons";

interface Props {
  message: string | null;
  onDismiss: () => void;
  /** Stays until dismissed (or the message is cleared), e.g. a failed check-off someone might not see in time. */
  persistent?: boolean;
}

/**
 * A brief, dismissible message at the bottom of the screen (design.md §8: concise, non-disruptive).
 * Hides itself after a few seconds, unless `persistent`.
 */
function Toast({ message, onDismiss, tone, persistent = false }: Props & { tone: "error" | "notice" }) {
  useEffect(() => {
    if (!message || persistent) return;
    const timer = setTimeout(onDismiss, tone === "error" ? 7000 : 5000);
    return () => clearTimeout(timer);
  }, [message, onDismiss, tone, persistent]);

  return (
    <div
      aria-live={tone === "error" ? "assertive" : "polite"}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4"
    >
      {message && (
        <div
          role={tone === "error" ? "alert" : "status"}
          className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-card border bg-panel p-3 text-sm ${
            tone === "error" ? "border-danger/50" : "border-line"
          }`}
        >
          {tone === "error" ? (
            <AlertIcon className="mt-0.5 size-4 shrink-0 text-danger" />
          ) : (
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" />
          )}
          <p className="flex-1 text-fg wrap-anywhere">{message}</p>
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

/** A failed save. Never used for routine success. */
export const ErrorFeedback = (props: Props) => <Toast {...props} tone="error" />;

/** Confirms a change whose result isn't visible where the user is, e.g. an item moved elsewhere or restored. */
export const NoticeFeedback = (props: Props) => <Toast {...props} tone="notice" />;
