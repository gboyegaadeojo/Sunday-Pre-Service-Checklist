import { Fragment, type ReactNode, useEffect, useState } from "react";
import type { MappingStatusResponse } from "../../../shared/types";
import { getJson } from "../../api";
import type { Navigate, Route } from "../../lib/router";
import { usePopover } from "../../lib/usePopover";
import { RouteLink } from "../app/RouteLink";
import { Chevron } from "../ui/Chevron";
import { ActivityIcon, ChecklistIcon, ChurchSettingsIcon, HistoryIcon, MappingIcon, OverviewIcon, UsersIcon } from "../ui/Icons";

export interface AdminSection {
  route: Route;
  label: string;
  /** One line about the section, on the Overview's shortcuts (design.md §7). */
  description: string;
  icon: (props: { className?: string }) => ReactNode;
  active: (r: Route) => boolean;
}

/** The sections of Administrative Settings (requirements v1.20, design.md §7), grouped. Only sections that exist. */
export const ADMIN_GROUPS: { label: string; sections: AdminSection[] }[] = [
  {
    label: "Service",
    sections: [
      { route: "admin-overview", label: "Overview", description: "The current service's progress at a glance.", icon: OverviewIcon, active: (r) => r === "admin-overview" },
      { route: "admin-activity", label: "Activity", description: "Check-offs, edits and changes, newest first.", icon: ActivityIcon, active: (r) => r === "admin-activity" },
      { route: "admin-history", label: "History", description: "Past services and what was done.", icon: HistoryIcon, active: (r) => r === "admin-history" },
    ],
  },
  {
    label: "Setup",
    sections: [
      // The checklist editor, its Hidden items (US-13a) and the task lists (US-11) are one section.
      {
        route: "admin-checklist",
        label: "Checklist Management",
        description: "Lists, departments, sections and tasks, and their order.",
        icon: ChecklistIcon,
        active: (r) => r === "admin-checklist" || r === "admin-hidden" || r === "admin-lists",
      },
      {
        route: "admin-mapping",
        label: "Team mapping",
        description: "Link scheduled teams and positions to departments.",
        icon: MappingIcon,
        active: (r) => r === "admin-mapping",
      },
      {
        route: "admin-settings",
        label: "Church settings",
        description: "Time zone, service day and branding.",
        icon: ChurchSettingsIcon,
        active: (r) => r === "admin-settings",
      },
    ],
  },
  {
    label: "People",
    sections: [
      { route: "admin-users", label: "Users & Permissions", description: "Everyone who has signed in, and their roles.", icon: UsersIcon, active: (r) => r === "admin-users" },
    ],
  },
];

export const ADMIN_SECTIONS: AdminSection[] = ADMIN_GROUPS.flatMap((g) => g.sections);

/**
 * How many positions in media teams lead to no department, plus links gone from the schedule source (Stage 7a):
 * shown on Team mapping so Admins notice from anywhere in Administrative Settings, with a quiet "new" for teams nobody
 * has reviewed yet. Re-checked on each section change and after any mapping change (MAPPING_CHANGED); the server
 * caches the schedule. Quietly nothing if it can't be loaded: the mapping screen explains.
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

type Attention = { attention: number; newTeams: number };

/** The count (needs linking) or a quiet "new" (teams to review) shown on Team mapping. */
export function MappingBadge({ attention, newTeams }: Attention) {
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
 * The grouped section list: one compact row per section (icon and label), the current one marked with a purple bar.
 * The desktop sidebar and the phone selector's menu.
 */
function SectionList({ route, onNavigate, attention, onPicked }: { route: Route; onNavigate: Navigate; attention: Attention; onPicked?: () => void }) {
  return (
    <div className="space-y-4">
      {ADMIN_GROUPS.map((g) => (
        <div key={g.label}>
          <p className="mb-1 px-3 text-meta font-medium text-fg-muted">{g.label}</p>
          <ul className="space-y-0.5">
            {g.sections.map((s) => {
              const current = s.active(route);
              const Icon = s.icon;
              return (
                <li key={s.route}>
                  <RouteLink
                    to={s.route}
                    current={current}
                    onNavigate={(to, search) => {
                      onPicked?.();
                      onNavigate(to, search);
                    }}
                    className={`relative flex min-h-11 items-center gap-3 rounded-control px-3 text-sm transition-colors ${
                      current ? "bg-hover font-medium text-fg" : "text-fg-muted hover:bg-hover hover:text-fg"
                    }`}
                  >
                    {current && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-1 rounded-full bg-accent" />}
                    <Icon className={`size-5 shrink-0 ${current ? "text-accent-soft" : ""}`} />
                    <span className="min-w-0 flex-1">{s.label}</span>
                    {s.route === "admin-mapping" && <MappingBadge {...attention} />}
                  </RouteLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Phones and tablets: a sticky "Section" selector under the header that opens the grouped list (like the department picker). */
function SectionPicker({ route, onNavigate, attention }: { route: Route; onNavigate: Navigate; attention: Attention }) {
  const { open, setOpen, close, rootRef, triggerRef } = usePopover();
  const current = ADMIN_SECTIONS.find((s) => s.active(route)) ?? ADMIN_SECTIONS[0];
  return (
    <div ref={rootRef} className="sticky top-14 z-20 border-b border-line bg-bg px-4 py-2 md:px-6 lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="admin-section-menu"
        className="flex min-h-12 w-full items-center gap-3 rounded-control border border-line bg-card px-3 py-1.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-meta text-fg-muted">Administrative Settings</span>
          <span className="flex items-center gap-2 text-sm leading-snug font-semibold">
            {current.label}
            {current.route !== "admin-mapping" && attention.attention > 0 && (
              <span className="rounded-full bg-warning/15 px-1.5 text-meta font-semibold text-warning">
                {attention.attention}
                <span className="sr-only"> team mapping item{attention.attention === 1 ? "" : "s"} to link</span>
              </span>
            )}
          </span>
        </span>
        <Chevron open={open} />
      </button>
      {open && (
        <nav
          id="admin-section-menu"
          aria-label="Administrative Settings sections"
          className="absolute inset-x-4 top-full mt-1 max-h-[calc(100dvh-9rem)] overflow-y-auto overscroll-contain rounded-card border border-line bg-panel p-2 md:inset-x-6"
        >
          <SectionList route={route} onNavigate={onNavigate} attention={attention} onPicked={close} />
        </nav>
      )}
    </div>
  );
}

/** Home / Administrative Settings / the section, so it's clear where you are (design.md §7). */
function Breadcrumb({ route, onNavigate }: { route: Route; onNavigate: Navigate }) {
  const section = ADMIN_SECTIONS.find((s) => s.active(route));
  const crumbs: { label: string; to?: Route }[] = [
    { label: "Home", to: "checklist" },
    route === "admin-overview" ? { label: "Administrative Settings" } : { label: "Administrative Settings", to: "admin-overview" },
    ...(section && route !== "admin-overview" ? [{ label: section.label }] : []),
  ];
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-1.5 text-meta text-fg-muted">
        {crumbs.map((c, i) => (
          <Fragment key={c.label}>
            {i > 0 && (
              <li aria-hidden="true">
                /
              </li>
            )}
            <li>
              {c.to ? (
                <RouteLink
                  to={c.to}
                  current={false}
                  onNavigate={onNavigate}
                  className="-my-3 inline-block py-3 underline-offset-2 transition-colors hover:text-fg hover:underline"
                >
                  {c.label}
                </RouteLink>
              ) : (
                <span aria-current="page" className="text-fg">
                  {c.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}

/** Checklist Management's two pages (the editor, with its Hidden items, and the task lists), as a switch. */
function ChecklistManagementSwitch({ route, onNavigate }: { route: Route; onNavigate: Navigate }) {
  const options: { to: Route; label: string; current: boolean }[] = [
    { to: "admin-checklist", label: "Checklist", current: route === "admin-checklist" || route === "admin-hidden" },
    { to: "admin-lists", label: "Lists", current: route === "admin-lists" },
  ];
  return (
    <nav aria-label="Checklist Management" className="mt-3 inline-flex gap-1 rounded-control border border-line bg-card p-1">
      {options.map((o) => (
        <RouteLink
          key={o.to}
          to={o.to}
          current={o.current}
          onNavigate={onNavigate}
          className={`flex min-h-11 min-w-20 items-center justify-center rounded-control px-4 text-sm transition-colors ${
            o.current ? "bg-accent font-semibold text-white" : "text-fg-muted hover:bg-hover hover:text-fg"
          }`}
        >
          {o.label}
        </RouteLink>
      ))}
    </nav>
  );
}

/**
 * The Overview's shortcuts: each section with its icon and one line about it (design.md §7).
 */
export function AdminShortcuts({ onNavigate, attention }: { onNavigate: Navigate; attention: Attention }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {ADMIN_SECTIONS.filter((s) => s.route !== "admin-overview").map((s) => {
        const Icon = s.icon;
        return (
          <li key={s.route}>
            <RouteLink
              to={s.route}
              current={false}
              onNavigate={onNavigate}
              className="flex h-full min-h-12 items-start gap-3 rounded-card border border-line bg-card px-4 py-3 transition-colors hover:bg-hover"
            >
              <Icon className="mt-0.5 size-5 shrink-0 text-fg-muted" />
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
 * Administrative Settings (requirements v1.20, design.md §7), reached from the menu under an Admin's name: a compact
 * sidebar from 1024px, a section selector below that, and a breadcrumb over each page. Pages line up with the
 * breadcrumb at one width, rather than each centring itself at its own.
 */
export function AdminLayout({ route, onNavigate, children }: { route: Route; onNavigate: Navigate; children: ReactNode }) {
  const attention = useMappingAttention(route);
  const checklistManagement = route === "admin-checklist" || route === "admin-hidden" || route === "admin-lists";
  return (
    <>
      <SectionPicker route={route} onNavigate={onNavigate} attention={attention} />
      <div className="mx-auto max-w-app lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-6 lg:px-6">
        <aside className="hidden lg:block">
          <nav aria-label="Administrative Settings sections" className="sticky top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto overscroll-contain pt-6 pb-4">
            <p className="mb-3 px-3 text-sm font-semibold text-fg">Administrative Settings</p>
            <SectionList route={route} onNavigate={onNavigate} attention={attention} />
          </nav>
        </aside>
        <div className="min-w-0">
          <div className="max-w-5xl px-4 pt-4 md:px-6 md:pt-6 lg:px-0">
            <Breadcrumb route={route} onNavigate={onNavigate} />
            {checklistManagement && <ChecklistManagementSwitch route={route} onNavigate={onNavigate} />}
          </div>
          {/* Each page keeps its own <main>; here it's aligned under the breadcrumb at one width. */}
          <div className="[&>main]:mx-0 [&>main]:max-w-5xl [&>main]:pt-3 lg:[&>main]:px-0">{children}</div>
        </div>
      </div>
    </>
  );
}
