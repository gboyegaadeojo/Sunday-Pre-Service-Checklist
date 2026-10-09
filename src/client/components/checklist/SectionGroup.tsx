import type { ChecklistSection } from "../../../shared/types";
import { plural } from "../../lib/checklist";
import { Chevron } from "../ui/Chevron";
import { TaskRow } from "./TaskRow";

interface Props {
  section: ChecklistSection;
  number: number;
  expanded: boolean;
  onToggle: () => void;
}

// A numbered section with a full-width toggle header (design.md §3D).
// Completed counts and "open the first incomplete section" are added in Stage 3.
export function SectionGroup({ section, number, expanded, onToggle }: Props) {
  const panelId = `section-${section.id}`;
  return (
    <div>
      <h2>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-hover"
        >
          <span className="w-6 shrink-0 text-meta text-fg-muted tabular-nums">{number}.</span>
          <span className="min-w-0 flex-1 text-base leading-snug font-semibold wrap-anywhere">{section.name}</span>
          <span className="shrink-0 text-meta text-fg-muted tabular-nums">{plural(section.tasks.length, "task")}</span>
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
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        ))}
    </div>
  );
}
