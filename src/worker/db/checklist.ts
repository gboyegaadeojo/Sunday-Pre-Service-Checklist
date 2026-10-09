import type { ChecklistCategory, ChecklistResponse, ChecklistSection } from "../../shared/types";

interface ChecklistRow {
  category_id: number;
  category_name: string;
  section_id: number | null;
  section_name: string | null;
  task_id: number | null;
  task_text: string | null;
}

/** The default list with its live (not deleted) categories, sections and tasks, in display order. */
export async function getDefaultChecklist(db: D1Database): Promise<ChecklistResponse | null> {
  const list = await db
    .prepare("SELECT id, name FROM task_lists WHERE is_default = 1 AND deleted_at IS NULL")
    .first<{ id: number; name: string }>();
  if (!list) return null;

  const { results } = await db
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
    .bind(list.id)
    .all<ChecklistRow>();

  // Rows arrive in display order, so the last category/section seen is the one to append to.
  const categories: ChecklistCategory[] = [];
  let category: ChecklistCategory | undefined;
  let section: ChecklistSection | undefined;
  for (const row of results) {
    if (category?.id !== row.category_id) {
      category = { id: row.category_id, name: row.category_name, sections: [] };
      categories.push(category);
      section = undefined;
    }
    if (row.section_id === null) continue;
    if (section?.id !== row.section_id) {
      section = { id: row.section_id, name: row.section_name!, tasks: [] };
      category.sections.push(section);
    }
    if (row.task_id !== null) section.tasks.push({ id: row.task_id, text: row.task_text! });
  }

  return { list, categories };
}
