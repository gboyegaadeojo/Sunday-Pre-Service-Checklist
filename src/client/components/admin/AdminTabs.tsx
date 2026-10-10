import { type ReactNode, useEffect, useRef, useState } from "react";
import type { MappingStatusResponse } from "../../../shared/types";
import { getJson } from "../../api";
import type { Navigate, Route } from "../../lib/router";
import { RouteLink } from "../app/RouteLink";
import { ActivityIcon, ChecklistIcon, HistoryIcon, ListsIcon, MappingIcon, OverviewIcon, UsersIcon } from "../ui/Icons";

export interface AdminSection {
  route: Route;
  label: string;
  /** One line under the label in the desktop menu and on the Overview page (design.md §7). */
  description: string;
  icon: (props: { className?: string }) => ReactNode;
  active: (r: Route) => boolean;
}

// The Admin area's sections, Overview first (design.md §7). Only sections that exist are listed.
export const ADMIN_SECTIONS: AdminSection[] = [
  { route: "admin-overview", label: "Overview", description: "The current service's progress at a glance.", icon: OverviewIcon, active: (r) => r === "admin-overview" },
  // Hidden items belong to the checklist (US-13a), reached from the editor.
  {
    route: "admin-checklist",
    label: "Checklist",
    description: "Departments, sections and tasks, and their order.",
    icon: ChecklistIcon,
    active: (r) => r === "admin-checklist" || r === "admin-hidden",
  },
  { route: "admin-lists", label: "Lists", description: "Task lists, and which one new services use.", icon: ListsIcon, active: (r) => r === "admin-lists" },
  {
    route: "admin-mapping",
    label: "Team mapping",
    description: "Link scheduled teams and positions to departments.",
    icon: MappingIcon,
    active: (r) => r === "admin-mapping",
  },
  { route: "admin-users", label: "Users", description: "Everyone who has signed in, and their roles.", icon: UsersIcon, active: (r) => r === "admin-users" },
  { route: "admin-activity", label: "Activity", description: "Check-offs, edits and changes, newest first.", icon: ActivityIcon, active: (r) => r === "admin-activity" },
  { route: "admin-history", label: "History", description: "Past services and what was done.", icon: HistoryIcon, active: (r) => r === "admin-history" },
];

/**
 * How many positions in media teams lead to no department, plus links gone from the schedule source (Stage 7a):
 * shown on Team mapping so Admins notice from anywhere in the Admin area, with a quiet "new" for teams nobody has
 * reviewed yet. Re-checked on each section change and after any mapping change (MAPPING_CHANGED); the server caches
 * the schedule. Quietly nothing if it can't be loaded: the mapping screen explains.
 */
export function useMappingAttention(route: Route) {
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

/** Dispatched on window by the mapping screen after a change, so the Team mapping count follows. */
export const MAPPING_CHANGED = "mapping-changed";

/** The count (needs linking) or a quiet "new" (teams to review) shown on Team mapping. */
export function MappingBadge({ attention, newTeams }: { attention: number; newTeams: number }) {
  if (attention > 0) {
    return (
      <span className="rounded-full bg-warning/15 px-1.5 text-meta font-semibold text-warning">
        {attention}
        <span className="sr-only"> need{attention === 1 ? "s" : ""} linking</span>
      </span>
    );
  }
  if (newTeams > 0) {
    return (
      <span className="rounded-full border border-line px-1.5 text-meta text-fg-muted">
        new<span className="sr-only"> team{newTeams === 1 ? "" : "s"} to review</span>
      </span>
    );
  }
  return null;
}

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

interface NavProps {
  route: Route;
  onNavigate: Navigate;
  attention: { attention: number; newTeams: number };
}

/** Phones and tablets: a compact strip of tabs under the header. */
function AdminTabStrip({ route, onNavigate, attention }: NavProps) {
  const { ref, more } = useTabScroll(route);
  return (
    <div className="relative border-b border-line bg-bg lg:hidden">
      <nav ref={ref} aria-label="Admin sections" className="mx-auto flex max-w-app gap-1 overflow-x-auto px-4 md:px-6">
        {ADMIN_SECTIONS.map((t) => {
          const current = t.active(route);
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
              {t.route === "admin-mapping" && <MappingBadge {...attention} />}
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

/**
 * The Admin sections as a menu: an icon, the name and one line about each (design.md §7). The desktop sidebar, and
 * the Overview page on phones (where the tab strip has no room for descriptions). The current one is outlined in
 * purple, like the selected department on the checklist.
 */
export function AdminMenu({ route, onNavigate, attention, sections = ADMIN_SECTIONS }: NavProps & { sections?: AdminSection[] }) {
  return (
    <ul className="space-y-2">
      {sections.map((s) => {
        const current = s.active(route);
        const Icon = s.icon;
        return (
          <li key={s.route}>
            <RouteLink
              to={s.route}
              current={current}
              onNavigate={onNavigate}
              className={`flex min-h-12 items-start gap-3 rounded-card border px-3.5 py-3 transition-colors ${
                current ? "border-accent bg-accent/10" : "border-line bg-card hover:bg-hover"
              }`}
            >
              <Icon className={`mt-0.5 size-5 shrink-0 ${current ? "text-accent-soft" : "text-fg-muted"}`} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                  {s.label}
                  {s.route === "admin-mapping" && <MappingBadge {...attention} />}
                </span>
                <span className="mt-0.5 block text-meta text-fg-muted">{s.description}</span>
              </span>
            </RouteLink>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The Admin workspace (design.md §7): the compact tab strip on phones and tablets; from 1024px a sidebar menu beside
 * the section's page.
 */
export function AdminLayout({ route, onNavigate, children }: { route: Route; onNavigate: Navigate; children: ReactNode }) {
  const attention = useMappingAttention(route);
  return (
    <>
      <AdminTabStrip route={route} onNavigate={onNavigate} attention={attention} />
      <div className="mx-auto max-w-app lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-2 lg:px-6">
        <aside className="hidden lg:block">
          <nav aria-label="Admin sections" className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain pt-6 pb-2">
            <p className="mb-2 px-1 text-meta font-semibold tracking-wide text-fg-muted uppercase">Admin</p>
            <AdminMenu route={route} onNavigate={onNavigate} attention={attention} />
          </nav>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </>
  );
}
