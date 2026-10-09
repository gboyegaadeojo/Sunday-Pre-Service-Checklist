import type { ChecklistCategory, ChecklistResponse, ChecklistSection, TaskCheckoff } from "../../shared/types";
import type { Service } from "./services";

interface ChecklistRow {
  category_id: number;
  category_name: string;
  section_id: number | null;
  section_name: string | null;
  task_id: number | null;
  task_text: string | null;
}

/**
 * The checklist for a service: its list's live (not deleted) categories, sections and tasks in display
 * order, each task with its active check-off. Check-offs are placed by the task's *current* location,
 * so a task moved mid-service stays checked in its new place (US-13).
 */
export async function getServiceChecklist(db: D1Database, service: Service): Promise<ChecklistResponse | null> {
  const [listResult, structure, checkoffRows] = await db.batch([
    db.prepare("SELECT id, name FROM task_lists WHERE id = ?").bind(service.listId),
    db
      .prepare(
        `SELECT c.id AS category_id, c.name AS category_name,
                s.id AS section_id, s.name AS section_name,
                t.id AS task_id, t.text AS task_text
           FROM categories c
           LEFT JOIN sections s ON s.category_id = c.id AND s.deleted_at IS NULL
           LEFT JOIN tasks t ON t.section_id = s.id AND t.deleted_at IS NULL
          WHERE c.list_id = ? AND c.deleted_at IS NULL
          ORDER BY c.sort_order, c.id, s.sort_order, s.id, t.sort_order, t.id`,
      )
      .bind(service.listId),
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

  // Rows arrive in display order, so the last category/section seen is the one to append to.
  // A non-null section_id/task_id means the LEFT JOIN matched, so its NOT NULL name/text is set.
  const categories: ChecklistCategory[] = [];
  let category: ChecklistCategory | undefined;
  let section: ChecklistSection | undefined;
  for (const row of structure.results as ChecklistRow[]) {
    if (category?.id !== row.category_id) {
      category = { id: row.category_id, name: row.category_name, sections: [] };
      categories.push(category);
      section = undefined;
    }
    if (row.section_id === null) continue;
    if (section?.id !== row.section_id) {
      section = { id: row.section_id, name: row.section_name as string, tasks: [] };
      category.sections.push(section);
    }
    if (row.task_id !== null) {
      section.tasks.push({ id: row.task_id, text: row.task_text as string, checkoff: checkoffs.get(row.task_id) ?? null });
    }
  }

  return {
    service: {
      id: service.id,
      date: service.date,
      isToday: service.isToday,
      published: service.pcoPlanId !== null,
      timeZone: service.timeZone,
    },
    list,
    categories,
  };
}
