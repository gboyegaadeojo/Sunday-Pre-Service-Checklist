import { useState } from "react";
import type { ChecklistResponse, CurrentUser } from "../../shared/types";
import { DepartmentNav } from "../components/checklist/DepartmentNav";
import { DepartmentPicker } from "../components/checklist/DepartmentPicker";
import { DepartmentView } from "../components/checklist/DepartmentView";
import { ServiceOverview } from "../components/checklist/ServiceOverview";
import { ErrorFeedback } from "../components/ui/Feedback";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { progressStatus, sectionProgress } from "../lib/checklist";
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
  const [collapsedSections, setCollapsedSections] = useState<Set<number> | null>(null);

  // Decided once, when the checklist first loads, so a section never snaps shut as its last task is checked.
  if (state.status === "ready" && collapsedSections === null) {
    setCollapsedSections(completedSectionIds(state.checklist));
  }

  const selectDepartment = (id: number) => {
    setSelectedId(id);
    window.scrollTo({ top: 0 });
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
    const departments = checklist.categories;
    if (departments.length === 0) {
      return <EmptyState title="This checklist has no departments yet." />;
    }
    const selected = departments.find((d) => d.id === selectedId) ?? departments[0];
    const collapsed = collapsedSections ?? new Set<number>();
    const toggleSection = (id: number) => {
      const next = new Set(collapsed);
      if (!next.delete(id)) next.add(id);
      setCollapsedSections(next);
    };

    return (
      <>
        <ServiceOverview checklist={checklist} saveState={saveState} />
        <DepartmentPicker departments={departments} selected={selected} onSelect={selectDepartment} />
        <div className="mt-4 md:mt-6 md:grid md:grid-cols-[15rem_minmax(0,1fr)] md:gap-6 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-8">
          <aside className="hidden md:block">
            <nav
              aria-label="Departments"
              className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain pb-2"
            >
              <p className="mb-2 px-4 text-meta font-medium text-fg-muted">Departments</p>
              <DepartmentNav departments={departments} selectedId={selected.id} onSelect={selectDepartment} />
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
