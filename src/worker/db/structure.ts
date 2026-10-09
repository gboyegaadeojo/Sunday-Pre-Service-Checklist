// Reading a list's live structure: categories → sections → tasks in display order. Shared by the
// checklist (with check-offs) and the admin editor. Deleted (hidden) rows are never included.

export interface StructureRow {
  category_id: number;
  category_name: string;
  section_id: number | null;
  section_name: string | null;
  task_id: number | null;
  task_text: string | null;
}

export interface Structure<T> {
  id: number;
  name: string;
  sections: { id: number; name: string; tasks: T[] }[];
}

/** One statement, so callers can put it in a db.batch with their other reads. */
export const structureStatement = (db: D1Database, listId: number) =>
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
    .bind(listId);

/**
 * Nests flat rows (already in display order) into categories → sections → tasks. A non-null
 * section_id/task_id means the LEFT JOIN matched, so its NOT NULL name/text is set.
 */
export function buildStructure<T>(rows: StructureRow[], makeTask: (id: number, text: string) => T): Structure<T>[] {
  const categories: Structure<T>[] = [];
  let category: Structure<T> | undefined;
  let section: Structure<T>["sections"][number] | undefined;
  for (const row of rows) {
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
    if (row.task_id !== null) section.tasks.push(makeTask(row.task_id, row.task_text as string));
  }
  return categories;
}
