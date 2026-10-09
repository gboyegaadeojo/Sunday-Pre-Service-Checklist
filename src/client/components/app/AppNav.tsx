import type { CurrentUser } from "../../../shared/types";
import { type Route, isAdminRoute } from "../../lib/router";
import { RouteLink } from "./RouteLink";

const LINKS: { route: Route; label: string; allowed: (u: CurrentUser) => boolean; active: (r: Route) => boolean }[] = [
  { route: "checklist", label: "Checklist", allowed: (u) => u.hasAccess, active: (r) => r === "checklist" },
  // Everyone with access sees progress (US-09, requirements v1.6).
  { route: "progress", label: "Progress", allowed: (u) => u.hasAccess, active: (r) => r === "progress" },
  // Admin workspace (design.md §7): checklist editor, activity log, and later settings. Server enforces too.
  { route: "admin-checklist", label: "Admin", allowed: (u) => u.isAdmin, active: isAdminRoute },
];

interface Props {
  user: CurrentUser;
  route: Route;
  onNavigate: (route: Route) => void;
}

// Role-authorized sections in the header (design.md §3A).
export function AppNav({ user, route, onNavigate }: Props) {
  const links = LINKS.filter((l) => l.allowed(user));
  if (links.length === 0) return null;

  return (
    <nav aria-label="Main" className="flex h-full items-stretch">
      {links.map((l) => {
        const current = l.active(route);
        return (
          <RouteLink
            key={l.route}
            to={l.route}
            current={current}
            onNavigate={onNavigate}
            className={`relative flex min-w-11 items-center justify-center px-2.5 text-sm transition-colors sm:px-3.5 ${
              current ? "font-semibold text-fg" : "text-fg-muted hover:text-fg"
            }`}
          >
            {l.label}
            {current && <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
          </RouteLink>
        );
      })}
    </nav>
  );
}
