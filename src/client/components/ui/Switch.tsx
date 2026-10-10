/** An on/off switch with its name visible; 44px tall (design.md §10). `ariaLabel` adds context, e.g. whose role. */
export function Switch({
  label,
  ariaLabel,
  on,
  disabled = false,
  onToggle,
}: {
  label: string;
  ariaLabel?: string;
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onToggle}
      className={`flex min-h-11 items-center gap-2 rounded-control border px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        on ? "border-accent bg-accent/15 text-fg" : "border-line bg-card text-fg-muted hover:bg-hover"
      }`}
    >
      <span aria-hidden="true" className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-line"}`}>
        <span className={`absolute top-0.5 size-3 rounded-full bg-white transition-[left] ${on ? "left-3.5" : "left-0.5"}`} />
      </span>
      {label}
    </button>
  );
}
