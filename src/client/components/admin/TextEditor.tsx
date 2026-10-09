import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { Button } from "../ui/Button";

interface Props {
  /** Visible label above the field. */
  label: string;
  initial?: string;
  maxLength: number;
  /** Task text can be long, so it gets a growing textarea; names get a single-line input. */
  multiline?: boolean;
  saveLabel?: string;
  /** Resolves true when saved; the editor closes then. On false it stays open with the text kept. */
  onSave: (value: string) => Promise<boolean>;
  onCancel: () => void;
}

// Inline add/rename/edit form. Enter saves (Shift+Enter is a new line in task text), Escape cancels.
// 16px text so phones don't zoom in on focus.
export function TextEditor({ label, initial = "", maxLength, multiline = false, saveLabel = "Save", onSave, onCancel }: Props) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const fieldId = useId();
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const trimmed = value.trim();

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, []);

  // Grow the textarea with its content.
  useEffect(() => {
    if (!multiline || !fieldRef.current) return;
    fieldRef.current.style.height = "auto";
    fieldRef.current.style.height = `${fieldRef.current.scrollHeight}px`;
  });

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!trimmed || busy) return;
    if (trimmed === initial.trim()) return onCancel();
    setBusy(true);
    const saved = await onSave(trimmed);
    setBusy(false);
    if (saved) onCancel();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const fieldClass =
    "w-full rounded-control border border-line bg-bg px-3 py-2.5 text-base text-fg placeholder:text-fg-muted focus-visible:border-accent-soft";

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-2">
      <div>
        <label htmlFor={fieldId} className="mb-1 block text-meta font-medium text-fg-muted">
          {label}
        </label>
        {multiline ? (
          <textarea
            id={fieldId}
            ref={fieldRef}
            rows={1}
            value={value}
            maxLength={maxLength}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            className={`${fieldClass} resize-none`}
          />
        ) : (
          <input
            id={fieldId}
            ref={fieldRef}
            value={value}
            maxLength={maxLength}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            className={fieldClass}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" disabled={!trimmed || busy}>
          {busy ? "Saving…" : saveLabel}
        </Button>
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        {value.length > maxLength * 0.8 && (
          <span className="text-meta text-fg-muted tabular-nums">
            {value.length}/{maxLength}
          </span>
        )}
      </div>
    </form>
  );
}
