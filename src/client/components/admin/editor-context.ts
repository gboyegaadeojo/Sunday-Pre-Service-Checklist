import { createContext, useContext } from "react";
import type { AdminListActions } from "../../lib/useAdminList";

/** The one inline editor that is open (only one at a time keeps a phone screen calm). */
export type Editing =
  | { kind: "add-category" }
  | { kind: "rename-category" | "add-section"; categoryId: number }
  | { kind: "rename-section" | "add-task"; sectionId: number }
  | { kind: "edit-task"; taskId: number }
  | null;

export interface HideRequest {
  kind: "category" | "section" | "task";
  id: number;
  name: string;
  /** Extra warning lines, e.g. how many tasks go with it. */
  details: string[];
}

export interface EditorContextValue {
  editing: Editing;
  setEditing: (e: Editing) => void;
  actions: AdminListActions;
  requestHide: (req: HideRequest) => void;
}

export const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used inside the checklist editor");
  return ctx;
}
