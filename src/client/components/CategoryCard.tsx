import type { ChecklistCategory } from "../../shared/types";

interface Props {
  category: ChecklistCategory;
  expanded: boolean;
  onToggle: () => void;
}

export function CategoryCard({ category, expanded, onToggle }: Props) {
  const taskCount = category.sections.reduce((n, s) => n + s.tasks.length, 0);
  const panelId = `category-${category.id}`;

  return (
    <section className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
      <h2>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-800/60"
        >
          <span className="flex-1">
            <span className="block text-lg font-semibold">{category.name}</span>
            <span className="block text-sm text-neutral-400">
              {category.sections.length} sections · {taskCount} tasks
            </span>
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className={`size-5 shrink-0 text-neutral-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <path fill="currentColor" d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
          </svg>
        </button>
      </h2>

      {expanded && (
        <div id={panelId} className="border-t border-neutral-800 px-4 pb-4">
          {category.sections.map((section, i) => (
            <div key={section.id} className="pt-4">
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-sky-300">
                {i + 1}. {section.name}
              </h3>
              <ul className="divide-y divide-neutral-800">
                {section.tasks.map((task) => (
                  <li key={task.id} className="flex min-h-11 items-start gap-3 py-2.5">
                    <span aria-hidden="true" className="mt-0.5 size-5 shrink-0 rounded-full border-2 border-neutral-600" />
                    <span className="leading-snug">{task.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
