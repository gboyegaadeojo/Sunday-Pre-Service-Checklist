import { useEffect, useId, useRef } from "react";
import { Button } from "../ui/Button";

// How to add the app to the home screen on iPhone and iPad (Stage 13, requirements C42), which have no install button
// for websites. A native <dialog>: modal, Escape closes, focus returns to what opened it.
export function InstallHowTo({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="bar m-auto w-[calc(100%-2rem)] max-w-md rounded-dialog p-0 text-fg backdrop:bg-bg/80"
    >
      <div className="p-5">
        <h2 id={titleId} className="text-lg font-semibold">
          Add to Home Screen
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
          <li>
            Tap the <span className="font-medium">Share</span> button: the square with an arrow pointing up, at the bottom of
            Safari (at the top on an iPad).
          </li>
          <li>
            Scroll down and tap <span className="font-medium">Add to Home Screen</span>.
          </li>
          <li>
            Tap <span className="font-medium">Add</span>. The app opens from its icon, full screen, already signed in.
          </li>
        </ol>
        <p className="mt-3 text-meta text-fg-muted">In Chrome or Edge on iPhone, the Share button is in the address bar.</p>
        <div className="mt-5 flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </dialog>
  );
}
