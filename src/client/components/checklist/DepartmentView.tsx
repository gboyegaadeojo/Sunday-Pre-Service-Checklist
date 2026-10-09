import type { ChecklistCategory } from "../../../shared/types";
import { countCategoryTasks, plural } from "../../lib/checklist";
import { EmptyState } from "../ui/States";
import { SectionGroup } from "./SectionGroup";

interface Props {
  department: ChecklistCategory;
  collapsedSections: Set<number>;
  onToggleSection: (id: number) => void;
}

export function DepartmentView({ department, collapsedSections, onToggleSection }: Props) {
  return (
    <section aria-labelledby="department-heading">
      <header className="mb-4">
        <h1 id="department-heading" className="text-page font-semibold tracking-tight wrap-anywhere">
          {department.name}
        </h1>
        <p className="mt-0.5 text-meta text-fg-muted">
          {plural(department.sections.length, "section")} · {plural(countCategoryTasks(department), "task")}
        </p>
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
              onToggle={() => onToggleSection(section.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
