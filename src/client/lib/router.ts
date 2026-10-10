import { useCallback, useEffect, useState } from "react";

// Minimal path router. The Worker serves index.html for any non-API path (SPA fallback), so these
// URLs survive reloads and can be bookmarked. Unknown paths show the checklist.

export type Route = "checklist" | "progress" | "admin-checklist" | "admin-hidden" | "admin-activity";

export const ROUTE_PATHS: Record<Route, string> = {
  checklist: "/",
  progress: "/progress",
  "admin-checklist": "/admin/checklist",
  "admin-hidden": "/admin/checklist/hidden",
  "admin-activity": "/admin/activity",
};

/** Older or shorter paths that still work. */
const ALIASES: Record<string, Route> = { "/admin": "admin-checklist", "/activity": "admin-activity" };

export const isAdminRoute = (r: Route) => r.startsWith("admin-");

const routeFromPath = (path: string): Route =>
  ALIASES[path] ?? (Object.entries(ROUTE_PATHS).find(([, p]) => p === path)?.[0] as Route | undefined) ?? "checklist";

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => routeFromPath(window.location.pathname));

  useEffect(() => {
    // Show the canonical address for an alias (e.g. /activity → /admin/activity).
    if (window.location.pathname !== ROUTE_PATHS[route] && ALIASES[window.location.pathname]) {
      window.history.replaceState(null, "", ROUTE_PATHS[route]);
    }
    const onPop = () => setRoute(routeFromPath(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [route]);

  const navigate = useCallback((next: Route) => {
    if (window.location.pathname !== ROUTE_PATHS[next]) window.history.pushState(null, "", ROUTE_PATHS[next]);
    setRoute(next);
    window.scrollTo({ top: 0 });
  }, []);

  return { route, navigate };
}
