import { useCallback, useEffect, useRef, useState } from "react";
import type { ChecklistResponse, ResetResponse } from "../../shared/types";
import { ApiError, getJson, isAuthError, postJson } from "../api";

export const REFRESH_MS = 30_000;

/**
 * Data for the progress view (US-09): the current service's checklist, refreshed about every 30 seconds
 * while the tab is visible, plus a manual refresh. A failed refresh keeps the last data on screen and
 * reports it as stale rather than blanking the page.
 */
export function useProgress({ onAccessChanged }: { onAccessChanged: () => void }) {
  const [data, setData] = useState<ChecklistResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null); // first load failed
  const [staleError, setStaleError] = useState<string | null>(null); // a later refresh failed
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false);
  const again = useRef(false); // a refresh was asked for while one was running
  const hasData = useRef(false);
  const onAccessChangedRef = useRef(onAccessChanged);
  onAccessChangedRef.current = onAccessChanged;

  const refresh = useCallback(async (): Promise<void> => {
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    setRefreshing(true);
    try {
      const next = await getJson<ChecklistResponse>("/api/checklist");
      setData(next);
      hasData.current = true;
      setUpdatedAt(new Date());
      setLoadError(null);
      setStaleError(null);
    } catch (err) {
      if (isAuthError(err)) return onAccessChangedRef.current();
      const message = (err as Error).message;
      if (hasData.current) setStaleError(message);
      else setLoadError(message);
    } finally {
      busy.current = false;
      setRefreshing(false);
    }
    if (again.current) {
      again.current = false;
      await refresh();
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  /** Reset or undo (Admins/Directors). Throws ApiError for the dialog to show; refreshes afterwards. */
  const runReset = async (kind: "reset" | "undo-reset"): Promise<ResetResponse> => {
    if (!data) throw new Error("Progress has not loaded yet.");
    try {
      return await postJson<ResetResponse>(`/api/services/${data.service.id}/${kind}`);
    } catch (err) {
      if (isAuthError(err) && !(err instanceof ApiError && err.code === "forbidden")) onAccessChangedRef.current();
      throw err;
    } finally {
      void refresh();
    }
  };

  return { data, loadError, staleError, updatedAt, refreshing, refresh: () => void refresh(), runReset };
}
