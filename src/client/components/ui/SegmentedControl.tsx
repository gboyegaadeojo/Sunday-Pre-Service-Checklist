import { type ReactNode, useId } from "react";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  /** Optional picture of the option above its label, e.g. a theme preview. */
  preview?: ReactNode;
}

/**
 * One choice from a few (design.md §10): native radio buttons drawn as side-by-side options, the chosen one outlined
 * in purple. The browser gives the keyboard behaviour: Tab reaches the group, arrow keys move and choose.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  /** The group's accessible name. */
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="grid grid-cols-3 gap-2">
      <legend className="sr-only">{label}</legend>
      {options.map((o) => {
        const checked = o.value === value;
        return (
          <label
            key={o.value}
            className={`flex min-h-11 cursor-pointer flex-col gap-2 rounded-card border p-2 transition-colors has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-accent-soft ${
              checked ? "border-accent bg-accent/10" : "border-line bg-card hover:bg-hover"
            }`}
          >
            <input type="radio" name={name} value={o.value} checked={checked} onChange={() => onChange(o.value)} className="sr-only" />
            {o.preview}
            <span className="flex items-center gap-2 px-1 pb-0.5 text-sm">
              {o.icon}
              <span className={checked ? "font-semibold text-fg" : "text-fg-muted"}>{o.label}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
