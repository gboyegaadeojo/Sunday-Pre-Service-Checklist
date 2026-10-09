import type { ChecklistCategory } from "../../../shared/types";
import { categoryProgress, percent, progressStatus } from "../../lib/checklist";
import { formatTime } from "../../lib/format";
import { Card } from "../ui/Card";
import { Chevron } from "../ui/Chevron";
import { CheckIcon } from "../ui/Icons";
import { ProgressBar } from "../ui/ProgressBar";
import { StatusDot } from "../ui/StatusDot";

interface Props {
  department: ChecklistCategory;
  timeZone: string;
  expanded: boolean;
  onToggle: () => void;
}

// One department on the progress view (US-09, design.md §6): name, explicit status label, counts,
// percentage and bar. Expanding shows every task with who checked it and when.
export function DepartmentProgressCard({ department, timeZone, expanded, onToggle }: Props) {
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
          className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-hover"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-base leading-snug font-semibold wrap-anywhere">{department.name}</span>
            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-meta">
              {status === "empty" ? <span className="text-fg-muted">No tasks</span> : <StatusDot status={status} showLabel />}
              <span className="text-fg-muted tabular-nums">
                {progress.done} of {progress.total} · {percent(progress)}%
              </span>
            </span>
            {progress.total > 0 && <ProgressBar progress={progress} label={`${department.name} progress`} className="mt-2.5" />}
          </span>
          <Chevron open={expanded} className="mt-0.5" />
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
                      <span className="min-w-0 flex-1 text-sm">
                        <span className={`block wrap-anywhere ${task.checkoff ? "text-fg" : "text-fg-muted"}`}>{task.text}</span>
                        <span className="block text-meta text-fg-muted">
                          {task.checkoff ? `${task.checkoff.by} · ${formatTime(task.checkoff.at, timeZone)}` : "Not done"}
                        </span>
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
