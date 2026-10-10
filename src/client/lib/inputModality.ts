// Which kind of input was used last, for the keyboard-only focus ring (design.md §8; styles.css): data-input on
// <html> is "keyboard" after a key press and "pointer" after a mouse click, tap or pen. Pointer until the first key.

const KEYS_THAT_MOVE_FOCUS = new Set(["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "Enter", " ", "Escape", "PageUp", "PageDown"]);

/** Starts tracking; returns a stop function (tests). */
export function startInputModality(): () => void {
  const root = document.documentElement;
  root.dataset.input = "pointer";
  // Only keys used to move around or act: typing letters into a field clicked with the mouse doesn't turn rings on.
  const onKey = (e: KeyboardEvent) => {
    if (KEYS_THAT_MOVE_FOCUS.has(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) root.dataset.input = "keyboard";
  };
  const onPointer = () => {
    root.dataset.input = "pointer";
  };
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("pointerdown", onPointer, true);
  return () => {
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("pointerdown", onPointer, true);
  };
}
