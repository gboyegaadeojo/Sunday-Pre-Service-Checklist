import { useCallback, useEffect, useState } from "react";

// Minimal path router. The Worker serves index.html for any non-API path (SPA fallback), so these
// URLs survive reloads and can be bookmarked. Unknown paths show the checklist. A query string (e.g.
// ?list=5 for the checklist editor) is kept alongside the route.

export type Route = "checklist" | "progress" | "admin-home" | "admin-checklist" | "admin-hidden" | "admin-lists" | "admin-mapping" | "admin-users" | "admin-activity" | "admin-history" | "admin-settings";

/** Goes to a route, optionally with a query string such as "?list=5". */
export type Navigate = (route: Route, search?: string) => void;

export const ROUTE_PATHS: Record<Route, string> = {
  checklist: "/",
  progress: "/progress",
  // Administrative Settings' landing page: what needs attention, and every section (design.md §7).
  "admin-home": "/admin",
  "admin-checklist": "/admin/checklist",
  "admin-hidden": "/admin/checklist/hidden",
  "admin-lists": "/admin/lists",
  "admin-mapping": "/admin/mapping",
  "admin-users": "/admin/users",
  "admin-activity": "/admin/activity",
  // ?service=ID opens one past service.
  "admin-history": "/admin/history",
  // Church settings (US-11a): a section of Administrative Settings since requirements v1.20.
  "admin-settings": "/admin/settings",
};

/** Older or shorter paths that still work. The address bar is switched to the canonical path. */
const ALIASES: Record<string, Route> = {
  "/activity": "admin-activity",
  "/preferences": "checklist", // My Preferences was removed: appearance is in the name menu (requirements v1.20)
  "/settings": "admin-settings", // where Church settings lived before it moved into Administrative Settings (v1.20)
};

export const isAdminRoute = (r: Route) => r.startsWith("admin-");

const routeFromPath = (path: string): Route =>
  ALIASES[path] ?? (Object.entries(ROUTE_PATHS).find(([, p]) => p === path)?.[0] as Route | undefined) ?? "checklist";

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => routeFromPath(window.location.pathname));
  const [search, setSearch] = useState(() => window.location.search);

  useEffect(() => {
    // Show the canonical address for an alias (e.g. /activity → /admin/activity, /settings → /admin/settings).
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
