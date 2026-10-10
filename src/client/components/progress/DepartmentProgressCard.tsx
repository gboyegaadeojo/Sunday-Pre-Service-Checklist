import type { ChecklistCategory } from "../../../shared/types";
import { categoryProgress, progressStatus } from "../../lib/checklist";
import { formatTime } from "../../lib/format";
import { Card } from "../ui/Card";
import { Chevron } from "../ui/Chevron";
import { CheckIcon } from "../ui/Icons";
import { ProgressBar } from "../ui/ProgressBar";
import { YoursBadge } from "../checklist/YoursBadge";
import { StatusText } from "./StatusText";

interface Props {
  department: ChecklistCategory;
  timeZone: string;
  expanded: boolean;
  onToggle: () => void;
  /** One of the person's own departments (US-05): listed first and marked "Yours". */
  yours?: boolean;
}

// One department on the progress view (US-09, design.md §6): name, "X of Y tasks completed", its status in words on
// the right, and a bar coloured by status. Expanding shows every task with who checked it and when.
export function DepartmentProgressCard({ department, timeZone, expanded, onToggle, yours = false }: Props) {
  const progress = categoryProgress(department);
  const status = progressStatus(progress);
  const panelId = `progress-${department.id}`;

  return (
    <Card className="overflow-hidden">
      <h2>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="block w-full px-4 py-3.5 text-left transition-colors hover:bg-hover"
        >
          <span className="flex items-start gap-3">
            <span className="min-w-0 flex-1">
              <span className="block text-base leading-snug font-semibold wrap-anywhere">
                {department.name}
                {yours && <YoursBadge />}
              </span>
              <span className="mt-0.5 block text-meta text-fg-muted tabular-nums">
                {progress.done} of {progress.total} tasks completed
              </span>
            </span>
            <StatusText status={status} className="mt-0.5" />
            <Chevron open={expanded} />
          </span>
          {progress.total > 0 && <ProgressBar progress={progress} label={`${department.name} progress`} tone="status" className="mt-3" />}
        </button>
      </h2>

      {expanded && (
        <div id={panelId} className="border-t border-line px-4 pt-1 pb-3">
          {department.sections.length === 0 && <p className="py-3 text-meta text-fg-muted">No tasks in this department yet.</p>}
          {department.sections.map((section, i) => (
            <div key={section.id} className="pt-3">
              <h3 className="text-sm font-semibold wrap-anywhere">
                <span className="text-fg-muted tabular-nums">{i + 1}.</span> {section.name}
              </h3>
              {section.tasks.length === 0 ? (
                <p className="mt-1 text-meta text-fg-muted">No tasks in this section yet.</p>
              ) : (
                <ul className="mt-1">
                  {section.tasks.map((task) => (
                    <li key={task.id} className="flex items-start gap-2.5 py-1.5">
                      {task.checkoff ? (
                        <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" />
                      ) : (
                        <span aria-hidden="true" className="mt-1 size-3.5 shrink-0 rounded-full border-2 border-idle" />
                      )}
                      {/* Who and when for done tasks only: a "Not done" line under every open task made long lists
                          hard to scan (design.md §6). The circle shows it, and screen readers hear it. */}
                      <span className="min-w-0 flex-1 text-sm">
                        <span className={`block wrap-anywhere ${task.checkoff ? "text-fg" : "text-fg-muted"}`}>
                          <span className="sr-only">{task.checkoff ? "Done: " : "Not done: "}</span>
                          {task.text}
                        </span>
                        {task.checkoff && (
                          <span className="block text-meta text-fg-muted">
                            {task.checkoff.by} · {formatTime(task.checkoff.at, timeZone)}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
