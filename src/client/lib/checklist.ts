import type { ChecklistCategory, ChecklistResponse, ChecklistSection, ChecklistTask, TaskCheckoff } from "../../shared/types";

export interface Progress {
  done: number;
  total: number;
}

/** "empty" = no tasks at all, so there is nothing to be done or not done. */
export type ProgressStatus = "complete" | "in_progress" | "not_started" | "empty";

const tally = (tasks: ChecklistTask[]): Progress => ({
  done: tasks.filter((t) => t.checkoff !== null).length,
  total: tasks.length,
});

const sum = (parts: Progress[]): Progress =>
  parts.reduce((acc, p) => ({ done: acc.done + p.done, total: acc.total + p.total }), { done: 0, total: 0 });

export const sectionProgress = (section: ChecklistSection) => tally(section.tasks);
export const categoryProgress = (category: ChecklistCategory) => sum(category.sections.map(sectionProgress));
export const checklistProgress = (checklist: ChecklistResponse) => sum(checklist.categories.map(categoryProgress));

export function progressStatus({ done, total }: Progress): ProgressStatus {
  if (total === 0) return "empty";
  if (done === total) return "complete";
  return done === 0 ? "not_started" : "in_progress";
}

export const percent = ({ done, total }: Progress) => (total === 0 ? 0 : Math.round((done / total) * 100));

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** A copy of the checklist with one task's check-off replaced. */
export function withCheckoff(checklist: ChecklistResponse, taskId: number, checkoff: TaskCheckoff | null): ChecklistResponse {
  return {
    ...checklist,
    categories: checklist.categories.map((c) => ({
      ...c,
      sections: c.sections.map((s) =>
        s.tasks.some((t) => t.id === taskId) ? { ...s, tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, checkoff } : t)) } : s,
      ),
    })),
  };
}
