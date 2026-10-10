import type { StructureKind } from "../../../shared/types";
import { type Position, reorderButtonId, useEditor } from "./editor-context";

const KIND: Record<StructureKind, string> = { category: "department", section: "section", task: "task" };

const ARROW = {
  up: "M10 4a1 1 0 0 1 .7.3l5 5a1 1 0 0 1-1.4 1.4L11 7.4V15a1 1 0 1 1-2 0V7.4l-3.3 3.3a1 1 0 0 1-1.4-1.4l5-5A1 1 0 0 1 10 4Z",
  down: "M10 16a1 1 0 0 1-.7-.3l-5-5a1 1 0 0 1 1.4-1.4L9 12.6V5a1 1 0 1 1 2 0v7.6l3.3-3.3a1 1 0 0 1 1.4 1.4l-5 5a1 1 0 0 1-.7.3Z",
};

/**
 * Reorder mode (build plan 5c.2): up/down arrows on a row, in place of its ⋯ menu, so several moves need
 * one tap each. 44px targets; disabled at either end. Same server endpoints as the menu's Move up/down.
 */
export function ReorderButtons({ kind, id, name, position }: { kind: StructureKind; id: number; name: string; position: Position }) {
  const { reorderItem } = useEditor();
  return (
    <div className="flex shrink-0">
      {(["up", "down"] as const).map((direction) => (
        <button
          key={direction}
          id={reorderButtonId(kind, id, direction)}
          type="button"
          aria-label={`Move ${direction} ${KIND[kind]}: ${name}`}
          disabled={direction === "up" ? position.first : position.last}
          onClick={() => reorderItem(kind, id, direction)}
          className="grid size-11 place-items-center rounded-control text-fg-muted transition-colors enabled:hover:bg-hover enabled:hover:text-fg disabled:opacity-30"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5">
            <path fill="currentColor" d={ARROW[direction]} />
          </svg>
        </button>
      ))}
    </div>
  );
}
