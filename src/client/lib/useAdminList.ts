import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminListResponse } from "../../shared/types";
import { ApiError, deleteJson, getJson, isAuthError, patchJson, postJson } from "../api";
import type { SaveState } from "./useChecklist";

export type AdminListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: AdminListResponse };

/**
 * The admin checklist editor's data (Stage 5). Every change goes to the server first and the list is
 * then reloaded, so the editor only ever shows what the server accepted. Returns true on success.
 */
export function useAdminList({ onAccessChanged }: { onAccessChanged: () => void }) {
  const [state, setState] = useState<AdminListState>({ status: "loading" });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const onAccessChangedRef = useRef(onAccessChanged);
  onAccessChangedRef.current = onAccessChanged;
  const dismissError = useCallback(() => setError(null), []);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setState({ status: "loading" });
    try {
      setState({ status: "ready", data: await getJson<AdminListResponse>("/api/admin/lists/default") });
    } catch (err) {
      if (isAuthError(err)) return onAccessChangedRef.current();
      setState({ status: "error", message: (err as Error).message });
    }
  }, []);

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
      if (err instanceof ApiError && err.status === 404) void load({ quiet: true }); // someone else changed it
      return false;
    }
  };

  const listId = state.status === "ready" ? state.data.list.id : null;
  return {
    state,
    reload: () => void load(),
    saveState,
    error,
    dismissError,
    addCategory: (name: string) => run(() => postJson(`/api/admin/lists/${listId}/categories`, { name })),
    addSection: (categoryId: number, name: string) => run(() => postJson(`/api/admin/categories/${categoryId}/sections`, { name })),
    addTask: (sectionId: number, text: string) => run(() => postJson(`/api/admin/sections/${sectionId}/tasks`, { text })),
    renameCategory: (id: number, name: string) => run(() => patchJson(`/api/admin/categories/${id}`, { name })),
    renameSection: (id: number, name: string) => run(() => patchJson(`/api/admin/sections/${id}`, { name })),
    editTask: (id: number, text: string) => run(() => patchJson(`/api/admin/tasks/${id}`, { text })),
    hideCategory: (id: number) => run(() => deleteJson(`/api/admin/categories/${id}`)),
    hideSection: (id: number) => run(() => deleteJson(`/api/admin/sections/${id}`)),
    hideTask: (id: number) => run(() => deleteJson(`/api/admin/tasks/${id}`)),
  };
}

export type AdminListActions = ReturnType<typeof useAdminList>;
