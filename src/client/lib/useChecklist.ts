import { useCallback, useEffect, useRef, useState } from "react";
import type { ChecklistResponse, ChecklistTask, CheckoffResponse } from "../../shared/types";
import { ApiError, deleteJson, getJson, isAuthError, putJson } from "../api";
import { withCheckoff } from "./checklist";

export type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; checklist: ChecklistResponse };

/** Last save outcome, for the "All changes saved" indicator (design.md §3: "whether changes have been saved"). */
export type SaveState = "idle" | "saving" | "saved" | "failed";

interface Options {
  /** Shown on optimistic check-offs until the server responds with the real record. */
  userName: string;
  /** The server said the session ended or access changed (401/403). */
  onAccessChanged: () => void;
}

/**
 * The current service's checklist and check-off actions (US-06): optimistic updates that revert if the
 * save fails, never showing a task as saved unless the server accepted it.
 */
export function useChecklist({ userName, onAccessChanged }: Options) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [pending, setPending] = useState<ReadonlySet<number>>(new Set());
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const dismissError = useCallback(() => setError(null), []);
  // Kept in a ref so a new callback from the parent never triggers a reload.
  const onAccessChangedRef = useRef(onAccessChanged);
  onAccessChangedRef.current = onAccessChanged;

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) setState({ status: "loading" });
      try {
        const checklist = await getJson<ChecklistResponse>("/api/checklist");
        setState({ status: "ready", checklist });
      } catch (err) {
        if (isAuthError(err)) return onAccessChangedRef.current();
        if (!quiet) setState({ status: "error", message: (err as Error).message });
      }
    },
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Pick up teammates' check-offs (and a new service day) when the volunteer comes back to the tab.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && pendingRef.current.size === 0) void load({ quiet: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  const setTaskCheckoff = (taskId: number, checkoff: ChecklistTask["checkoff"]) =>
    setState((s) => (s.status === "ready" ? { ...s, checklist: withCheckoff(s.checklist, taskId, checkoff) } : s));

  const toggle = async (task: ChecklistTask) => {
    if (state.status !== "ready" || pendingRef.current.has(task.id)) return;
    const { service } = state.checklist;
    const before = task.checkoff;
    const url = `/api/services/${service.id}/tasks/${task.id}/checkoff`;

    setTaskCheckoff(task.id, before ? null : { by: userName, at: new Date().toISOString() });
    setPending((p) => new Set(p).add(task.id));
    setSaveState("saving");
    setError(null);
    try {
      const res = before ? await deleteJson<CheckoffResponse>(url) : await putJson<CheckoffResponse>(url);
      setTaskCheckoff(task.id, res.checkoff);
      setSaveState("saved");
    } catch (err) {
      setTaskCheckoff(task.id, before); // revert: the server did not accept the change
      setSaveState("failed");
      if (isAuthError(err)) return onAccessChangedRef.current();
      if (err instanceof ApiError && (err.code === "service_changed" || err.status === 404)) {
        setError(err.message);
        void load({ quiet: true });
      } else {
        setError(`Couldn't save "${task.text}". ${(err as Error).message}`);
      }
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(task.id);
        return next;
      });
    }
  };

  return {
    state,
    reload: () => void load(),
    toggle: (task: ChecklistTask) => void toggle(task),
    pending,
    saveState: pending.size > 0 ? ("saving" as const) : saveState,
    error,
    dismissError,
  };
}
