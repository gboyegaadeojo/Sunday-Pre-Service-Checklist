import type { ChecklistSection, ChecklistTask } from "../../../shared/types";
import { progressStatus, sectionProgress } from "../../lib/checklist";
import { Chevron } from "../ui/Chevron";
import { CheckIcon } from "../ui/Icons";
import { TaskRow } from "./TaskRow";

interface Props {
  section: ChecklistSection;
  number: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  timeZone: string;
  savingTaskIds: ReadonlySet<number>;
  failedTaskIds: ReadonlySet<number>;
  onToggleTask: (task: ChecklistTask) => void;
}

// A numbered section with a full-width toggle header showing done/total (design.md §3D).
export function SectionGroup({ section, number, expanded, onToggleExpanded, timeZone, savingTaskIds, failedTaskIds, onToggleTask }: Props) {
  const panelId = `section-${section.id}`;
  const progress = sectionProgress(section);
  const complete = progressStatus(progress) === "complete";

  return (
    <div>
      <h2>
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-hover"
        >
          <span className="w-6 shrink-0 text-meta text-fg-muted tabular-nums">{number}.</span>
          <span className={`min-w-0 flex-1 text-base leading-snug font-semibold wrap-anywhere ${complete ? "text-fg-muted" : ""}`}>
            {section.name}
          </span>
          <span className={`flex shrink-0 items-center gap-1 text-meta tabular-nums ${complete ? "text-success" : "text-fg-muted"}`}>
            {complete && <CheckIcon className="size-3.5" />}
            {progress.done}/{progress.total}
            <span className="sr-only">tasks done{complete ? ", section complete" : ""}</span>
          </span>
          <Chevron open={expanded} />
        </button>
      </h2>
      {expanded &&
        (section.tasks.length === 0 ? (
          <p id={panelId} className="px-4 pb-4 pl-13 text-meta text-fg-muted">
            No tasks in this section yet.
          </p>
        ) : (
          <ul id={panelId} className="pb-2">
            {section.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                timeZone={timeZone}
                saving={savingTaskIds.has(task.id)}
                failed={failedTaskIds.has(task.id)}
                onToggle={() => onToggleTask(task)}
              />
            ))}
          </ul>
        ))}
    </div>
  );
}
