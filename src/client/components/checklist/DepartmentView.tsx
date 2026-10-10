import type { ChecklistCategory, ChecklistTask } from "../../../shared/types";
import { categoryProgress } from "../../lib/checklist";
import { Card } from "../ui/Card";
import { ProgressBar } from "../ui/ProgressBar";
import { EmptyState } from "../ui/States";
import { SectionGroup } from "./SectionGroup";

interface Props {
  department: ChecklistCategory;
  collapsedSections: ReadonlySet<number>;
  onToggleSection: (id: number) => void;
  timeZone: string;
  savingTaskIds: ReadonlySet<number>;
  failedTaskIds: ReadonlySet<number>;
  onToggleTask: (task: ChecklistTask) => void;
}

export function DepartmentView({ department, collapsedSections, onToggleSection, timeZone, savingTaskIds, failedTaskIds, onToggleTask }: Props) {
  const progress = categoryProgress(department);
  return (
    <section aria-labelledby="department-heading">
      {/* On phones the sticky department bar already names the department and its count, so the heading is for
          screen readers only there and the tasks start higher up (design.md §5). */}
      {/* The department's header card: name, "X of Y complete · Z remaining" and its bar (design.md §3). */}
      <Card className="mb-3 px-5 py-4 max-md:sr-only">
        <h1 id="department-heading" className="text-title font-semibold wrap-anywhere">
          {department.name}
        </h1>
        {progress.total > 0 && (
          <>
            <p className="mt-0.5 text-meta text-fg-muted tabular-nums">
              {progress.done} of {progress.total} complete · {progress.total - progress.done} remaining
            </p>
            <ProgressBar progress={progress} label={`${department.name} progress`} className="mt-3" />
          </>
        )}
      </Card>

      {department.sections.length === 0 ? (
        <EmptyState title="No tasks in this department yet." />
      ) : (
        <div className="space-y-3">
          {department.sections.map((section, i) => (
            <SectionGroup
              key={section.id}
              section={section}
              number={i + 1}
              expanded={!collapsedSections.has(section.id)}
              onToggleExpanded={() => onToggleSection(section.id)}
              timeZone={timeZone}
              savingTaskIds={savingTaskIds}
              failedTaskIds={failedTaskIds}
              onToggleTask={onToggleTask}
            />
          ))}
        </div>
      )}
    </section>
  );
}
