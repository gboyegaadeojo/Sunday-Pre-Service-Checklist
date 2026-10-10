import type { ChecklistSection, ChecklistTask } from "../../../shared/types";
import { progressStatus, sectionProgress } from "../../lib/checklist";
import { Card } from "../ui/Card";
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

// A section in its own card: a small "SECTION 1" label above its name, done/total, and the whole header toggles it
// (design.md §3D). Numbers come from the order, never stored.
export function SectionGroup({ section, number, expanded, onToggleExpanded, timeZone, savingTaskIds, failedTaskIds, onToggleTask }: Props) {
  const panelId = `section-${section.id}`;
  const progress = sectionProgress(section);
  const complete = progressStatus(progress) === "complete";

  return (
    <Card className="overflow-hidden">
      <h2>
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-hover"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-meta font-medium tracking-wide text-fg-muted uppercase tabular-nums">Section {number}</span>
            <span className={`mt-0.5 block text-base leading-snug font-semibold wrap-anywhere ${complete ? "text-fg-muted" : ""}`}>
              {section.name}
            </span>
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
          <p id={panelId} className="border-t border-line px-4 py-3 text-meta text-fg-muted">
            No tasks in this section yet.
          </p>
        ) : (
          <ul id={panelId} className="divide-y divide-line border-t border-line">
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
    </Card>
  );
}
