import { useState } from "react";
import type { ChecklistResponse, CurrentUser } from "../../shared/types";
import { DepartmentNav } from "../components/checklist/DepartmentNav";
import { DepartmentPicker } from "../components/checklist/DepartmentPicker";
import { DepartmentScope } from "../components/checklist/DepartmentScope";
import { DepartmentView } from "../components/checklist/DepartmentView";
import { ServiceOverview } from "../components/checklist/ServiceOverview";
import { ErrorFeedback } from "../components/ui/Feedback";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { progressStatus, sectionProgress } from "../lib/checklist";
import { recallForToday, rememberForToday } from "../lib/forToday";
import { useChecklist } from "../lib/useChecklist";

/** Sections already finished when the page loads start collapsed (design.md §3D); after that the volunteer decides. */
const completedSectionIds = (checklist: ChecklistResponse) =>
  new Set(
    checklist.categories.flatMap((c) =>
      c.sections.filter((s) => progressStatus(sectionProgress(s)) === "complete").map((s) => s.id),
    ),
  );

/** onAccessChanged: the server said the session ended or access was revoked (US-03), so re-check. */
export function ChecklistPage({ user, onAccessChanged }: { user: CurrentUser; onAccessChanged: () => void }) {
  const { state, reload, toggle, pending, saveState, error, dismissError } = useChecklist({
    userName: user.name,
    onAccessChanged,
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // "Show all departments" (US-05): null until this device's choice for today is read.
  const [showAll, setShowAll] = useState<boolean | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<number> | null>(null);

  // Decided once, when the checklist first loads, so a section never snaps shut as its last task is checked.
  if (state.status === "ready" && collapsedSections === null) {
    setCollapsedSections(completedSectionIds(state.checklist));
  }

  // This device's choices for today, read once the church's time zone is known.
  if (state.status === "ready" && showAll === null) {
    const { timeZone } = state.checklist.service;
    setShowAll(recallForToday("showAll", timeZone) === "1");
    const picked = Number(recallForToday("department", timeZone));
    if (picked && state.checklist.categories.some((c) => c.id === picked)) setSelectedId(picked);
  }

  const timeZone = state.status === "ready" ? state.checklist.service.timeZone : "UTC";
  const selectDepartment = (id: number) => {
    setSelectedId(id);
    rememberForToday("department", timeZone, String(id)); // remembered on this device for the day (US-05)
    window.scrollTo({ top: 0 });
  };
  const changeShowAll = (on: boolean) => {
    setShowAll(on);
    rememberForToday("showAll", timeZone, on ? "1" : null);
  };

  return (
    <main className="mx-auto max-w-app px-4 pt-4 pb-24 md:px-6 md:pt-6">
      {state.status === "loading" && <LoadingState label="Loading checklist…" />}

      {state.status === "error" && <ErrorState title="Couldn't load the checklist" message={state.message} onRetry={reload} />}

      {state.status === "ready" && renderChecklist(state.checklist)}

      <ErrorFeedback message={error} onDismiss={dismissError} />
    </main>
  );

  function renderChecklist(checklist: ChecklistResponse) {
    if (checklist.categories.length === 0) {
      return <EmptyState title="This checklist has no departments yet." />;
    }
    // US-05: a scheduled volunteer's own departments only, unless they show all; otherwise everything, own first.
    const { view } = checklist;
    const ownIds = new Set(view.own);
    const own = view.own.flatMap((id) => checklist.categories.filter((c) => c.id === id));
    const others = checklist.categories.filter((c) => !ownIds.has(c.id));
    const departments = view.mode === "own" && !showAll ? own : [...own, ...others];
    // "Yours" only tells something apart when other departments are listed too.
    const marked = departments.length > own.length ? ownIds : undefined;
    const selected = departments.find((d) => d.id === selectedId) ?? departments[0];
    const collapsed = collapsedSections ?? new Set<number>();
    const toggleSection = (id: number) => {
      const next = new Set(collapsed);
      if (!next.delete(id)) next.add(id);
      setCollapsedSections(next);
    };

    return (
      <>
        {/* While a scheduled volunteer sees only their own department(s), their progress leads (US-05). */}
        <ServiceOverview checklist={checklist} saveState={saveState} own={view.mode === "own" && !showAll ? own : undefined} />
        <DepartmentScope view={view} own={own} showAll={showAll ?? false} onShowAllChange={changeShowAll} />
        <DepartmentPicker departments={departments} selected={selected} onSelect={selectDepartment} ownIds={marked} />
        <div className="mt-4 md:mt-6 md:grid md:grid-cols-[15rem_minmax(0,1fr)] md:gap-6 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-8">
          <aside className="hidden md:block">
            <nav
              aria-label="Departments"
              className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain pb-2"
            >
              <p className="mb-2 px-4 text-meta font-medium text-fg-muted">Departments</p>
              <DepartmentNav departments={departments} selectedId={selected.id} onSelect={selectDepartment} ownIds={marked} />
            </nav>
          </aside>
          <DepartmentView
            department={selected}
            collapsedSections={collapsed}
            onToggleSection={toggleSection}
            timeZone={checklist.service.timeZone}
            savingTaskIds={pending}
            onToggleTask={toggle}
          />
        </div>
      </>
    );
  }
}
