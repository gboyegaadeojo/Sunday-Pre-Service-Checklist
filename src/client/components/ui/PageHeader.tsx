import type { ReactNode } from "react";

/**
 * A page's heading (design.md §2, §10): the 24px title, a 14px description at a comfortable line length, then
 * anything else under them (`children`, e.g. a save status), with the page's actions on the right (below on phones).
 * The same on every page, so headings, descriptions and content line up; it leaves 24px before the content.
 */
export function PageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 pb-2">
      <div className="min-w-0 max-w-reading">
        <h1 className="text-page font-semibold tracking-tight wrap-anywhere">{title}</h1>
        {description && <p className="mt-1 text-sm leading-relaxed text-fg-muted">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-x-4 gap-y-2">{actions}</div>}
    </header>
  );
}
