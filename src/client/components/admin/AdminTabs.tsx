import { useEffect, useRef, useState } from "react";
import type { MappingStatusResponse } from "../../../shared/types";
import { getJson } from "../../api";
import type { Navigate, Route } from "../../lib/router";
import { RouteLink } from "../app/RouteLink";

const TABS: { route: Route; label: string; active: (r: Route) => boolean }[] = [
  // Hidden items belong to the checklist (US-13a), reached from the editor.
  { route: "admin-checklist", label: "Checklist", active: (r) => r === "admin-checklist" || r === "admin-hidden" },
  { route: "admin-lists", label: "Lists", active: (r) => r === "admin-lists" },
  { route: "admin-mapping", label: "Team mapping", active: (r) => r === "admin-mapping" },
  { route: "admin-users", label: "Users", active: (r) => r === "admin-users" },
  { route: "admin-activity", label: "Activity", active: (r) => r === "admin-activity" },
  { route: "admin-history", label: "History", active: (r) => r === "admin-history" },
];

/**
 * How many positions in media teams lead to no department, plus links gone from the schedule source (Stage 7a):
 * shown on the Team mapping tab so Admins notice from anywhere in the Admin area, with a quiet "new" for teams nobody
 * has reviewed yet. Re-checked on each section change and after any mapping change (MAPPING_CHANGED); the server
 * caches the schedule. Quietly nothing if it can't be loaded: the mapping screen explains.
 */
function useMappingAttention(route: Route) {
  const [count, setCount] = useState({ attention: 0, newTeams: 0 });
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-check whenever the Admin moves between sections
  useEffect(() => {
    let live = true;
    const check = () =>
      getJson<MappingStatusResponse>("/api/admin/mapping/status")
        .then((s) => live && setCount({ attention: s.unlinked + s.missing, newTeams: s.newTeams }))
        .catch(() => live && setCount({ attention: 0, newTeams: 0 }));
    void check();
    window.addEventListener(MAPPING_CHANGED, check);
    return () => {
      live = false;
      window.removeEventListener(MAPPING_CHANGED, check);
    };
  }, [route]);
  return count;
}

/** Dispatched on window by the mapping screen after a change, so the tab's count follows. */
export const MAPPING_CHANGED = "mapping-changed";

/**
 * On narrow screens the tabs scroll sideways (design.md §5): the current tab is scrolled into view, and each edge
 * fades while more tabs are off screen that side, so it's clear there are more.
 */
function useTabScroll(route: Route) {
  const ref = useRef<HTMLElement>(null);
  const [more, setMore] = useState({ left: false, right: false });
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when the current tab changes
  useEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    const current = nav.querySelector<HTMLElement>("[aria-current=page]");
    if (current && nav.scrollWidth > nav.clientWidth) {
      nav.scrollLeft = Math.max(0, current.offsetLeft + current.offsetWidth - nav.clientWidth + 16);
    }
    const update = () => setMore({ left: nav.scrollLeft > 1, right: nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1 });
    update();
    nav.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      nav.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [route]);
  return { ref, more };
}

// Sections of the Admin workspace (design.md §7). Only sections that exist are listed.
export function AdminTabs({ route, onNavigate }: { route: Route; onNavigate: Navigate }) {
  const { attention, newTeams } = useMappingAttention(route);
  const { ref, more } = useTabScroll(route);
  return (
    <div className="relative border-b border-line bg-bg">
      <nav ref={ref} aria-label="Admin sections" className="mx-auto flex max-w-app gap-1 overflow-x-auto px-4 md:px-6">
        {/* The header's Admin tab already says where you are, so phones give this room to the tabs. */}
        <span className="mr-2 hidden items-center text-meta font-semibold tracking-wide text-fg-muted uppercase sm:flex">Admin</span>
        {TABS.map((t) => {
          const current = t.active(route);
          const badge = t.route === "admin-mapping" && attention > 0 ? attention : 0;
          return (
            <RouteLink
              key={t.route}
              to={t.route}
              current={current}
              onNavigate={onNavigate}
              className={`relative flex min-h-11 items-center gap-1.5 px-3 text-sm whitespace-nowrap transition-colors ${
                current ? "font-semibold text-fg" : "text-fg-muted hover:text-fg"
              }`}
            >
              {t.label}
              {badge > 0 && (
                <span className="rounded-full bg-warning/15 px-1.5 text-meta font-semibold text-warning">
                  {badge}
                  <span className="sr-only"> need{badge === 1 ? "s" : ""} linking</span>
                </span>
              )}
              {/* New teams are informational: a quiet "new", only when nothing needs fixing. */}
              {t.route === "admin-mapping" && badge === 0 && newTeams > 0 && (
                <span className="rounded-full border border-line px-1.5 text-meta text-fg-muted">
                  new<span className="sr-only"> team{newTeams === 1 ? "" : "s"} to review</span>
                </span>
              )}
              {current && <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
            </RouteLink>
          );
        })}
      </nav>
      {more.left && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-linear-to-r from-bg to-transparent" />}
      {more.right && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-bg to-transparent" />}
    </div>
  );
}
