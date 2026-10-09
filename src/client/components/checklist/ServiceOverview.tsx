import type { ChecklistResponse } from "../../../shared/types";
import { countAllTasks, plural } from "../../lib/checklist";
import { Card } from "../ui/Card";

// Service overview (design.md §3B). Stage 1 has no service or check-off data, so it shows only
// the checklist and its real totals. Service date and progress are added in Stage 3.
export function ServiceOverview({ checklist }: { checklist: ChecklistResponse }) {
  return (
    <Card
      role="region"
      aria-label="Service overview"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3"
    >
      <p className="min-w-0">
        <span className="block text-meta text-fg-muted">Checklist</span>
        <span className="block font-semibold">{checklist.list.name}</span>
      </p>
      <p className="text-meta text-fg-muted">
        {plural(checklist.categories.length, "department")} · {plural(countAllTasks(checklist), "task")}
      </p>
    </Card>
  );
}
