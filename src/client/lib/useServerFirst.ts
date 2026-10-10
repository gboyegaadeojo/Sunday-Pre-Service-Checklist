import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getJson, isAuthError } from "../api";
import type { SaveState } from "./useChecklist";

export type LoadState<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: T };

/**
 * Admin screens that change data on the server (Stage 5). Every change goes to the server first and
 * `path` is then reloaded, so the screen only ever shows what the server accepted. `run` resolves true on
 * success; on failure it keeps the message in `error`.
 */
export function useServerFirst<T>(path: string, { onAccessChanged }: { onAccessChanged: () => void }) {
  const [state, setState] = useState<LoadState<T>>({ status: "loading" });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const onAccessChangedRef = useRef(onAccessChanged);
  onAccessChangedRef.current = onAccessChanged;
  const dismissError = useCallback(() => setError(null), []);

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) setState({ status: "loading" });
      try {
        setState({ status: "ready", data: await getJson<T>(path) });
      } catch (err) {
        if (isAuthError(err)) return onAccessChangedRef.current();
        setState({ status: "error", message: (err as Error).message });
      }
    },
    [path],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (request: () => Promise<unknown>): Promise<boolean> => {
    setSaveState("saving");
    setError(null);
    try {
      await request();
      await load({ quiet: true });
      setSaveState("saved");
      return true;
    } catch (err) {
      setSaveState("failed");
      if (isAuthError(err)) {
        onAccessChangedRef.current();
        return false;
      }
      setError((err as Error).message);
      // 404/409: someone else changed it, so show the latest.
      if (err instanceof ApiError && (err.status === 404 || err.status === 409)) void load({ quiet: true });
      return false;
    }
  };

  return { state, reload: () => void load(), saveState, error, dismissError, run };
}
