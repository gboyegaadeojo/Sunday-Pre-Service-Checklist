import { createContext, useContext } from "react";
import type { StructureKind } from "../../../shared/types";
import type { AdminListActions } from "../../lib/useAdminList";
import type { ActionItem } from "../ui/ActionMenu";

/** The one inline editor that is open (only one at a time keeps a phone screen calm). */
export type Editing =
  | { kind: "add-category" }
  | { kind: "rename-category" | "add-section"; categoryId: number }
  | { kind: "rename-section" | "add-task"; sectionId: number }
  | { kind: "edit-task"; taskId: number }
  | null;

export interface HideRequest {
  kind: StructureKind;
  id: number;
  name: string;
  /** Extra warning lines, e.g. how many tasks go with it. */
  details: string[];
}

/** "Move to…" for a task (to any section) or a section (to any department) (US-12a, US-13). */
export type MoveRequest =
  | { kind: "task"; id: number; name: string; categoryId: number; sectionId: number }
  | { kind: "section"; id: number; name: string; categoryId: number };

export interface EditorContextValue {
  editing: Editing;
  setEditing: (e: Editing) => void;
  actions: AdminListActions;
  requestHide: (req: HideRequest) => void;
  requestMove: (req: MoveRequest) => void;
  reorderItem: (kind: StructureKind, id: number, direction: "up" | "down") => void;
  /** The item that just moved (itemKey), briefly highlighted so it's easy to find again. */
  recent: string | null;
}

export const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used inside the checklist editor");
  return ctx;
}

export const itemKey = (kind: StructureKind, id: number) => `${kind}-${id}`;

/** ID of an item's "⋯" button, so focus can return to it after the item moves. */
export const menuButtonId = (kind: StructureKind, id: number) => `editor-menu-${itemKey(kind, id)}`;

/** Background for the item that just moved. */
export const RECENT_CLASS = "bg-accent/15";

/** Where an item sits among its live siblings. */
export interface Position {
  first: boolean;
  last: boolean;
}

/** "Move up" / "Move down" menu entries, disabled at either end. */
export const reorderItems = (ctx: EditorContextValue, kind: StructureKind, id: number, { first, last }: Position): ActionItem[] => [
  { label: "Move up", disabled: first, onSelect: () => ctx.reorderItem(kind, id, "up") },
  { label: "Move down", disabled: last, onSelect: () => ctx.reorderItem(kind, id, "down") },
];
