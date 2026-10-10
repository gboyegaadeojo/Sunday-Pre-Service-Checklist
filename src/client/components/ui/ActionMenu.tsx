import { usePopover } from "../../lib/usePopover";

export interface ActionItem {
  label: string;
  onSelect: () => void;
  /** Destructive actions (e.g. Hide) are shown in the error colour and always confirm afterwards. */
  danger?: boolean;
  /** Shown but not selectable, e.g. "Move up" on the first item. */
  disabled?: boolean;
}

/**
 * A "⋯" button that opens a short list of actions for one item (design.md §8: accessible menus).
 * 44px target; closes on selection, outside tap or Escape, returning focus to the button.
 * `id` names the button, so a page can put focus back on it after the item moves.
 */
export function ActionMenu({ id, label, items }: { id: string; label: string; items: ActionItem[] }) {
  const { open, setOpen, close, rootRef, triggerRef } = usePopover();
  const menuId = `${id}-items`;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className="grid size-11 place-items-center rounded-control text-fg-muted transition-colors hover:bg-hover hover:text-fg"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5">
          <path fill="currentColor" d="M4 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm4.5 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm4.5 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" />
        </svg>
      </button>
      {open && (
        <ul id={menuId} className="absolute top-full right-0 z-40 mt-1 min-w-48 rounded-card border border-line bg-panel p-1.5">
          {items.map((item) => (
            <li key={item.label}>
              <button
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  close();
                  item.onSelect();
                }}
                className={`flex min-h-11 w-full items-center rounded-control px-3 text-left text-sm transition-colors enabled:hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40 ${
                  item.danger ? "text-danger" : "text-fg"
                }`}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
