import type { ChecklistCategory, ChecklistTask } from "../../../shared/types";
import { categoryProgress } from "../../lib/checklist";
import { ProgressBar } from "../ui/ProgressBar";
import { EmptyState } from "../ui/States";
import { SectionGroup } from "./SectionGroup";

interface Props {
  department: ChecklistCategory;
  collapsedSections: ReadonlySet<number>;
  onToggleSection: (id: number) => void;
  timeZone: string;
  savingTaskIds: ReadonlySet<number>;
  onToggleTask: (task: ChecklistTask) => void;
}

export function DepartmentView({ department, collapsedSections, onToggleSection, timeZone, savingTaskIds, onToggleTask }: Props) {
  const progress = categoryProgress(department);
  return (
    <section aria-labelledby="department-heading">
      <header className="mb-4">
        <h1 id="department-heading" className="text-page font-semibold tracking-tight wrap-anywhere">
          {department.name}
        </h1>
        {progress.total > 0 && (
          <div className="mt-2 flex max-w-sm items-center gap-3">
            <ProgressBar progress={progress} label={`${department.name} progress`} className="flex-1" />
            <span className="shrink-0 text-meta text-fg-muted tabular-nums">
              {progress.done} of {progress.total} done
            </span>
          </div>
        )}
      </header>

      {department.sections.length === 0 ? (
        <EmptyState title="No tasks in this department yet." />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
          {department.sections.map((section, i) => (
            <SectionGroup
              key={section.id}
              section={section}
              number={i + 1}
              expanded={!collapsedSections.has(section.id)}
              onToggleExpanded={() => onToggleSection(section.id)}
              timeZone={timeZone}
              savingTaskIds={savingTaskIds}
              onToggleTask={onToggleTask}
            />
          ))}
        </div>
      )}
    </section>
  );
}
