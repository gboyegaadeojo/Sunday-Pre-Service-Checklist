import type { ChecklistCategory, ChecklistResponse } from "../../shared/types";

export const countCategoryTasks = (category: ChecklistCategory) =>
  category.sections.reduce((n, s) => n + s.tasks.length, 0);

export const countAllTasks = (checklist: ChecklistResponse) =>
  checklist.categories.reduce((n, c) => n + countCategoryTasks(c), 0);

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
