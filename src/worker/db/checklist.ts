import type { ChecklistResponse, TaskCheckoff } from "../../shared/types";
import type { Service } from "./services";
import { type StructureRow, buildStructure, structureStatement } from "./structure";

/**
 * The checklist for a service: its list's live (not deleted) categories, sections and tasks in display
 * order, each task with its active check-off. Check-offs are placed by the task's *current* location,
 * so a task moved mid-service stays checked in its new place (US-13).
 */
export async function getServiceChecklist(db: D1Database, service: Service): Promise<Omit<ChecklistResponse, "view"> | null> {
  const [listResult, structure, checkoffRows] = await db.batch([
    db.prepare("SELECT id, name FROM task_lists WHERE id = ?").bind(service.listId),
    structureStatement(db, service.listId),
    db
      .prepare(
        `SELECT task_id, checked_by_name, checked_at FROM checkoffs
          WHERE service_id = ? AND unchecked_at IS NULL AND reset_id IS NULL`,
      )
      .bind(service.id),
  ]);
  const list = listResult.results[0] as { id: number; name: string } | undefined;
  if (!list) return null;

  const checkoffs = new Map<number, TaskCheckoff>(
    (checkoffRows.results as { task_id: number; checked_by_name: string; checked_at: string }[]).map((r) => [
      r.task_id,
      { by: r.checked_by_name, at: r.checked_at },
    ]),
  );

  return {
    service: {
      id: service.id,
      date: service.date,
      isToday: service.isToday,
      published: service.planExternalId !== null,
      timeZone: service.timeZone,
    },
    list,
    categories: buildStructure(structure.results as StructureRow[], (id, text) => ({
      id,
      text,
      checkoff: checkoffs.get(id) ?? null,
    })),
  };
}
