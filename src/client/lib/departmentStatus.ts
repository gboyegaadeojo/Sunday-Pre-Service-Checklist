import type { ChecklistCategory } from "../../shared/types";
import { categoryProgress } from "./checklist";

// Whose checklist is showing (US-05, design.md §3C): the person's own scheduled department, another one they're helping
// with, or none of theirs (not scheduled, position not linked, no plan published, or the schedule couldn't be loaded:
// in every one of those the server sends no departments of their own).

export type DepartmentStatus = { kind: "yours" } | { kind: "helping"; backTo: ChecklistCategory } | { kind: "choose" };

export function departmentStatus(selected: ChecklistCategory, own: ChecklistCategory[]): DepartmentStatus {
  if (own.some((d) => d.id === selected.id)) return { kind: "yours" };
  const [first] = own;
  return first ? { kind: "helping", backTo: first } : { kind: "choose" };
}

const SPOKEN: Record<DepartmentStatus["kind"], string> = {
  yours: "your checklist",
  helping: "helping out, not your department",
  choose: "choose your department",
};

/** The picker button's name: "Technical Director, your checklist, 0 of 7 done. Change department". */
export function pickerLabel(selected: ChecklistCategory, status: DepartmentStatus): string {
  const { done, total } = categoryProgress(selected);
  return `${selected.name}, ${SPOKEN[status.kind]}, ${done} of ${total} done. Change department`;
}
