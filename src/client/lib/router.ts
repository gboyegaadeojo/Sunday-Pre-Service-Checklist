import { useCallback, useEffect, useState } from "react";

// Minimal path router. The Worker serves index.html for any non-API path (SPA fallback), so these
// URLs survive reloads and can be bookmarked. Unknown paths show the checklist. A query string (e.g.
// ?list=5 for the checklist editor) is kept alongside the route.

export type Route = "checklist" | "progress" | "admin-checklist" | "admin-hidden" | "admin-lists" | "admin-mapping" | "admin-users" | "admin-activity" | "admin-history" | "settings";

/** Goes to a route, optionally with a query string such as "?list=5". */
export type Navigate = (route: Route, search?: string) => void;

export const ROUTE_PATHS: Record<Route, string> = {
  checklist: "/",
  progress: "/progress",
  "admin-checklist": "/admin/checklist",
  "admin-hidden": "/admin/checklist/hidden",
  "admin-lists": "/admin/lists",
  "admin-mapping": "/admin/mapping",
  "admin-users": "/admin/users",
  "admin-activity": "/admin/activity",
  // ?service=ID opens one past service.
  "admin-history": "/admin/history",
  // Admin-only, but opened from the user menu rather than the Admin tabs.
  settings: "/settings",
};

/** Older or shorter paths that still work. The address bar is switched to the canonical path. */
const ALIASES: Record<string, Route> = {
  "/admin": "admin-checklist",
  "/activity": "admin-activity",
  "/admin/settings": "settings", // where Settings lived before it moved to the user menu
};

export const isAdminRoute = (r: Route) => r.startsWith("admin-");

const routeFromPath = (path: string): Route =>
  ALIASES[path] ?? (Object.entries(ROUTE_PATHS).find(([, p]) => p === path)?.[0] as Route | undefined) ?? "checklist";

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => routeFromPath(window.location.pathname));
  const [search, setSearch] = useState(() => window.location.search);

  useEffect(() => {
    // Show the canonical address for an alias (e.g. /activity → /admin/activity, /admin/settings → /settings).
    if (window.location.pathname !== ROUTE_PATHS[route] && ALIASES[window.location.pathname]) {
      window.history.replaceState(null, "", ROUTE_PATHS[route]);
    }
    const onPop = () => {
      setRoute(routeFromPath(window.location.pathname));
      setSearch(window.location.search);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [route]);

  const navigate = useCallback<Navigate>((next, nextSearch = "") => {
    const url = ROUTE_PATHS[next] + nextSearch;
    if (window.location.pathname + window.location.search !== url) window.history.pushState(null, "", url);
    setRoute(next);
    setSearch(nextSearch);
    window.scrollTo({ top: 0 });
  }, []);

  return { route, search, navigate };
}
