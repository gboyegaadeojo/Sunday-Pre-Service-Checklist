import type { AdminListResponse, HiddenItemsResponse, StructureKind } from "../../shared/types";
import { deleteJson, patchJson, postJson } from "../api";
import { useServerFirst } from "./useServerFirst";

/** URL segment for each kind under /api/admin. */
export const KIND_PATH: Record<StructureKind, string> = { category: "categories", section: "sections", task: "tasks" };

/** The admin checklist editor's data (Stage 5). Server first, then reload; never optimistic. */
export function useAdminList({ onAccessChanged }: { onAccessChanged: () => void }) {
  const { run, ...rest } = useServerFirst<AdminListResponse>("/api/admin/lists/default", { onAccessChanged });
  const listId = rest.state.status === "ready" ? rest.state.data.list.id : null;
  return {
    ...rest,
    addCategory: (name: string) => run(() => postJson(`/api/admin/lists/${listId}/categories`, { name })),
    addSection: (categoryId: number, name: string) => run(() => postJson(`/api/admin/categories/${categoryId}/sections`, { name })),
    addTask: (sectionId: number, text: string) => run(() => postJson(`/api/admin/sections/${sectionId}/tasks`, { text })),
    renameCategory: (id: number, name: string) => run(() => patchJson(`/api/admin/categories/${id}`, { name })),
    renameSection: (id: number, name: string) => run(() => patchJson(`/api/admin/sections/${id}`, { name })),
    editTask: (id: number, text: string) => run(() => patchJson(`/api/admin/tasks/${id}`, { text })),
    hideCategory: (id: number) => run(() => deleteJson(`/api/admin/categories/${id}`)),
    hideSection: (id: number) => run(() => deleteJson(`/api/admin/sections/${id}`)),
    hideTask: (id: number) => run(() => deleteJson(`/api/admin/tasks/${id}`)),
    // Stage 5b: restructuring (US-12, US-12a, US-13).
    reorder: (kind: StructureKind, id: number, direction: "up" | "down") =>
      run(() => postJson(`/api/admin/${KIND_PATH[kind]}/${id}/reorder`, { direction })),
    moveTask: (id: number, sectionId: number) => run(() => postJson(`/api/admin/tasks/${id}/move`, { sectionId })),
    moveSection: (id: number, categoryId: number) => run(() => postJson(`/api/admin/sections/${id}/move`, { categoryId })),
  };
}

export type AdminListActions = ReturnType<typeof useAdminList>;

/** Hidden items of the default list, and restoring them (US-13a). */
export function useHiddenItems({ onAccessChanged }: { onAccessChanged: () => void }) {
  const { run, ...rest } = useServerFirst<HiddenItemsResponse>("/api/admin/lists/default/hidden", { onAccessChanged });
  return {
    ...rest,
    restore: (kind: StructureKind, id: number, withParents: boolean) =>
      run(() => postJson(`/api/admin/${KIND_PATH[kind]}/${id}/restore`, { withParents })),
  };
}
