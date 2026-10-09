import type { Route } from "../../lib/router";
import { RouteLink } from "../app/RouteLink";

const TABS: { route: Route; label: string }[] = [
  { route: "admin-checklist", label: "Checklist" },
  { route: "admin-activity", label: "Activity" },
];

// Sections of the Admin workspace (design.md §7). Only sections that exist are listed.
export function AdminTabs({ route, onNavigate }: { route: Route; onNavigate: (route: Route) => void }) {
  return (
    <div className="border-b border-line bg-bg">
      <nav aria-label="Admin sections" className="mx-auto flex max-w-app gap-1 overflow-x-auto px-4 md:px-6">
        <span className="mr-2 flex items-center text-meta font-semibold tracking-wide text-fg-muted uppercase">Admin</span>
        {TABS.map((t) => {
          const current = t.route === route;
          return (
            <RouteLink
              key={t.route}
              to={t.route}
              current={current}
              onNavigate={onNavigate}
              className={`relative flex min-h-11 items-center px-3 text-sm whitespace-nowrap transition-colors ${
                current ? "font-semibold text-fg" : "text-fg-muted hover:text-fg"
              }`}
            >
              {t.label}
              {current && <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
            </RouteLink>
          );
        })}
      </nav>
    </div>
  );
}
