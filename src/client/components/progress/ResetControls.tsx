import { useState } from "react";
import type { ResetInfo, ResetResponse } from "../../../shared/types";
import { formatServiceDate, formatTime } from "../../lib/format";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { ConfirmDialog } from "../ui/ConfirmDialog";

interface Props {
  serviceDate: string;
  timeZone: string;
  /** Check-offs currently on the service. */
  checkedCount: number;
  reset: ResetInfo | null;
  onRun: (kind: "reset" | "undo-reset") => Promise<ResetResponse>;
}

const plural = (n: number) => `${n} check-off${n === 1 ? "" : "s"}`;

// Reset and "Undo reset" for Admins and Directors (US-07, US-10, design.md §6, §8). Both confirm first.
export function ResetControls({ serviceDate, timeZone, checkedCount, reset, onRun }: Props) {
  const [dialog, setDialog] = useState<"reset" | "undo-reset" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const open = (kind: "reset" | "undo-reset") => {
    setError(null);
    setNotice(null);
    setDialog(kind);
  };

  const confirm = async () => {
    if (!dialog) return;
    setBusy(true);
    setError(null);
    try {
      const res = await onRun(dialog);
      setNotice(dialog === "reset" ? `Checklist reset. ${plural(res.affected)} cleared.` : `Reset undone. ${plural(res.affected)} restored.`);
      setDialog(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card role="region" aria-label="Reset" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 md:px-5">
      <div className="min-w-0 text-meta">
        <p className="font-medium text-fg">Reset</p>
        {reset ? (
          <p className="text-fg-muted">
            Last reset by {reset.by} at {formatTime(reset.at, timeZone)} ({plural(reset.archived)} cleared)
            {reset.undoneAt && reset.undoneBy && <> · undone by {reset.undoneBy} at {formatTime(reset.undoneAt, timeZone)}</>}
          </p>
        ) : (
          <p className="text-fg-muted">This service hasn't been reset.</p>
        )}
        {/* Said in words: a tooltip on the disabled button never shows on a phone. */}
        {checkedCount === 0 && <p className="text-fg-muted">Nothing to reset yet: no tasks are checked.</p>}
        {notice && (
          <p role="status" className="mt-1 text-success">
            {notice}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {reset?.canUndo && <Button onClick={() => open("undo-reset")}>Undo reset</Button>}
        <Button
          variant="danger-outline"
          onClick={() => open("reset")}
          disabled={checkedCount === 0}
        >
          Reset checklist
        </Button>
      </div>

      <ConfirmDialog
        open={dialog === "reset"}
        title="Reset this checklist?"
        confirmLabel="Reset checklist"
        tone="danger"
        busy={busy}
        error={error}
        onConfirm={() => void confirm()}
        onCancel={() => setDialog(null)}
      >
        <p className="text-fg">This will clear all check-offs for this service. Are you sure?</p>
        <p>
          {plural(checkedCount)} for {formatServiceDate(serviceDate)} will be cleared. They stay in the history, and an Admin or
          Director can undo this until the next reset.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "undo-reset"}
        title="Undo the last reset?"
        confirmLabel="Undo reset"
        busy={busy}
        error={error}
        onConfirm={() => void confirm()}
        onCancel={() => setDialog(null)}
      >
        {reset && (
          <p>
            This restores the {plural(reset.archived)} cleared by {reset.by} at {formatTime(reset.at, timeZone)}. Tasks checked
            since the reset keep their newer check-off.
          </p>
        )}
      </ConfirmDialog>
    </Card>
  );
}
