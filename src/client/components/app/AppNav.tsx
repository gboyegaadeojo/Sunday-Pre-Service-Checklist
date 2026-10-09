import type { MouseEvent } from "react";
import type { CurrentUser } from "../../../shared/types";
import { ROUTE_PATHS, type Route } from "../../lib/router";

const LINKS: { route: Route; label: string; allowed: (u: CurrentUser) => boolean }[] = [
  { route: "checklist", label: "Checklist", allowed: (u) => u.hasAccess },
  // Everyone with access sees progress (US-09, requirements v1.6).
  { route: "progress", label: "Progress", allowed: (u) => u.hasAccess },
  // The activity log is Admin-only; the server enforces this too.
  { route: "activity", label: "Activity", allowed: (u) => u.isAdmin },
];

interface Props {
  user: CurrentUser;
  route: Route;
  onNavigate: (route: Route) => void;
}

// Role-authorized sections in the header (design.md §3A). Real links, so new-tab/middle-click work.
export function AppNav({ user, route, onNavigate }: Props) {
  const links = LINKS.filter((l) => l.allowed(user));
  if (links.length === 0) return null;

  const onClick = (e: MouseEvent<HTMLAnchorElement>, to: Route) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate(to);
  };

  return (
    <nav aria-label="Main" className="flex h-full items-stretch">
      {links.map((l) => {
        const current = l.route === route;
        return (
          <a
            key={l.route}
            href={ROUTE_PATHS[l.route]}
            onClick={(e) => onClick(e, l.route)}
            aria-current={current ? "page" : undefined}
            className={`relative flex min-w-11 items-center justify-center px-2.5 text-sm transition-colors sm:px-3.5 ${
              current ? "font-semibold text-fg" : "text-fg-muted hover:text-fg"
            }`}
          >
            {l.label}
            {current && <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
          </a>
        );
      })}
    </nav>
  );
}
