import type {
  AdminListResponse,
  CreatedResponse,
  CreateListRequest,
  HiddenItemsResponse,
  ListsResponse,
  MappingResponse,
  SetLinkRequest,
  SettingsResponse,
  StructureKind,
  UpdateRolesRequest,
  UpdateRolesResponse,
  UpdateSettingsRequest,
  UpdateSettingsResponse,
  UsersResponse,
} from "../../shared/types";
import { deleteJson, patchJson, postJson, putJson } from "../api";
import { useServerFirst } from "./useServerFirst";

/** URL segment for each kind under /api/admin. */
export const KIND_PATH: Record<StructureKind, string> = { category: "categories", section: "sections", task: "tasks" };

/** Which list an admin screen shows: an ID from ?list=…, or the default list. */
export type ListRef = number | "default";

/** ?list=5 → 5; anything else → the default list. */
export function listRefFrom(search: string): ListRef {
  const param = new URLSearchParams(search).get("list");
  return param && /^\d+$/.test(param) ? Number(param) : "default";
}

/** The admin checklist editor's data (Stage 5). Server first, then reload; never optimistic. */
export function useAdminList({ listRef, onAccessChanged }: { listRef: ListRef; onAccessChanged: () => void }) {
  const { run, ...rest } = useServerFirst<AdminListResponse>(`/api/admin/lists/${listRef}`, { onAccessChanged });
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

/** Hidden items of a list, and restoring them (US-13a). */
export function useHiddenItems({ listRef, onAccessChanged }: { listRef: ListRef; onAccessChanged: () => void }) {
  const { run, ...rest } = useServerFirst<HiddenItemsResponse>(`/api/admin/lists/${listRef}/hidden`, { onAccessChanged });
  return {
    ...rest,
    restore: (kind: StructureKind, id: number, withParents: boolean) =>
      run(() => postJson(`/api/admin/${KIND_PATH[kind]}/${id}/restore`, { withParents })),
  };
}

/** All task lists (Stage 5d.1, US-11): create, rename/describe, set the default, hide and restore. */
export function useLists({ onAccessChanged }: { onAccessChanged: () => void }) {
  const { run, ...rest } = useServerFirst<ListsResponse>("/api/admin/lists", { onAccessChanged });
  return {
    ...rest,
    /** Resolves to the new list's ID, or null if it wasn't created. */
    create: async (body: CreateListRequest) => {
      let id: number | null = null;
      await run(async () => {
        id = (await postJson<CreatedResponse>("/api/admin/lists", body)).id;
      });
      return id;
    },
    update: (id: number, name: string, description: string | null) => run(() => patchJson(`/api/admin/lists/${id}`, { name, description })),
    /** Resolves to whether the current service switched too, or null if it failed. */
    setDefault: async (id: number, applyToCurrentService: boolean) => {
      let switched: boolean | null = null;
      await run(async () => {
        switched = (await postJson<{ serviceSwitched: boolean }>(`/api/admin/lists/${id}/default`, { applyToCurrentService })).serviceSwitched;
      });
      return switched;
    },
    hide: (id: number) => run(() => deleteJson(`/api/admin/lists/${id}`)),
    restore: (id: number) => run(() => postJson(`/api/admin/lists/${id}/restore`)),
  };
}

/** Church settings (Stage 5d.2, US-11a): read, and save every field at once. */
export function useSettings({ onAccessChanged }: { onAccessChanged: () => void }) {
  const { run, ...rest } = useServerFirst<SettingsResponse>("/api/admin/settings", { onAccessChanged });
  return {
    ...rest,
    /** Resolves to what the server saved, or null if it failed. */
    save: async (body: UpdateSettingsRequest) => {
      let saved: UpdateSettingsResponse | null = null;
      await run(async () => {
        saved = await putJson<UpdateSettingsResponse>("/api/admin/settings", body);
      });
      return saved as UpdateSettingsResponse | null;
    },
  };
}

/** People and their roles (Stage 6, US-03): grant or revoke Admin and Director. */
export function useUsers({ onAccessChanged }: { onAccessChanged: () => void }) {
  const { run, ...rest } = useServerFirst<UsersResponse>("/api/admin/users", { onAccessChanged });
  return {
    ...rest,
    setRoles: (id: number, roles: UpdateRolesRequest) => run(() => putJson<UpdateRolesResponse>(`/api/admin/users/${id}/roles`, roles)),
  };
}

/** Team mapping (Stage 7a, US-15): the Service Type, links, and "Refresh from Planning Center". */
export function useMapping({ onAccessChanged }: { onAccessChanged: () => void }) {
  const { run, ...rest } = useServerFirst<MappingResponse>("/api/admin/mapping", { onAccessChanged });
  return {
    ...rest,
    setServiceType: (externalId: string) => run(() => putJson("/api/admin/mapping/service-type", { externalId })),
    setLink: (body: SetLinkRequest) => run(() => putJson("/api/admin/mapping/link", body)),
    /** Marks a team with no links "Not a media team", or undoes it. */
    setNotMediaTeam: (teamExternalId: string, notMediaTeam: boolean) =>
      run(() => putJson("/api/admin/mapping/team-review", { teamExternalId, notMediaTeam })),
    /** Fetches the teams and positions anew from the source, then shows them. */
    refresh: () => run(() => postJson("/api/admin/mapping/refresh")),
  };
}
