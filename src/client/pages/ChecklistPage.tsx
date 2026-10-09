import { useCallback, useEffect, useState } from "react";
import type { ChecklistResponse } from "../../shared/types";
import { getJson, isAuthError } from "../api";
import { DepartmentNav } from "../components/checklist/DepartmentNav";
import { DepartmentPicker } from "../components/checklist/DepartmentPicker";
import { DepartmentView } from "../components/checklist/DepartmentView";
import { ServiceOverview } from "../components/checklist/ServiceOverview";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; checklist: ChecklistResponse };

/** onAccessChanged: the server said the session ended or access was revoked (US-03), so re-check. */
export function ChecklistPage({ onAccessChanged }: { onAccessChanged: () => void }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      setState({ status: "ready", checklist: await getJson<ChecklistResponse>("/api/checklist") });
    } catch (err) {
      if (isAuthError(err)) return onAccessChanged();
      setState({ status: "error", message: (err as Error).message });
    }
  }, [onAccessChanged]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleSection = (id: number) =>
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const selectDepartment = (id: number) => {
    setSelectedId(id);
    window.scrollTo({ top: 0 });
  };

  return (
    <main className="mx-auto max-w-app px-4 pt-4 pb-16 md:px-6 md:pt-6">
        {state.status === "loading" && <LoadingState label="Loading checklist…" />}

        {state.status === "error" && (
          <ErrorState title="Couldn't load the checklist" message={state.message} onRetry={() => void load()} />
        )}

        {state.status === "ready" && renderChecklist(state.checklist)}
    </main>
  );

  function renderChecklist(checklist: ChecklistResponse) {
    const departments = checklist.categories;
    if (departments.length === 0) {
      return <EmptyState title="This checklist has no departments yet." />;
    }
    const selected = departments.find((d) => d.id === selectedId) ?? departments[0];

    return (
      <>
        <ServiceOverview checklist={checklist} />
        <DepartmentPicker departments={departments} selected={selected} onSelect={selectDepartment} />
        <div className="mt-4 md:mt-6 md:grid md:grid-cols-[15rem_minmax(0,1fr)] md:gap-6 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-8">
          <aside className="hidden md:block">
            <nav aria-label="Departments" className="sticky top-20">
              <p className="mb-2 px-4 text-meta font-medium text-fg-muted">Departments</p>
              <DepartmentNav departments={departments} selectedId={selected.id} onSelect={selectDepartment} />
            </nav>
          </aside>
          <DepartmentView
            department={selected}
            collapsedSections={collapsedSections}
            onToggleSection={toggleSection}
          />
        </div>
      </>
    );
  }
}
