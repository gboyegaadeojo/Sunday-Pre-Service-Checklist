import { useCallback, useEffect, useState } from "react";

// Minimal path router. The Worker serves index.html for any non-API path (SPA fallback), so these
// URLs survive reloads and can be bookmarked. Unknown paths show the checklist.

export type Route = "checklist" | "progress" | "activity";

export const ROUTE_PATHS: Record<Route, string> = { checklist: "/", progress: "/progress", activity: "/activity" };

const routeFromPath = (path: string): Route =>
  (Object.entries(ROUTE_PATHS).find(([, p]) => p === path)?.[0] as Route | undefined) ?? "checklist";

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => routeFromPath(window.location.pathname));

  useEffect(() => {
    const onPop = () => setRoute(routeFromPath(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((next: Route) => {
    if (window.location.pathname !== ROUTE_PATHS[next]) window.history.pushState(null, "", ROUTE_PATHS[next]);
    setRoute(next);
    window.scrollTo({ top: 0 });
  }, []);

  return { route, navigate };
}
