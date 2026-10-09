import type { TaskCheckoff } from "../../shared/types";

// A check-off is active when it has not been unchecked or archived by a reset.
export const ACTIVE = "unchecked_at IS NULL AND reset_id IS NULL";

/** Who made a check/uncheck request, for the append-only checkoff_events log. */
export interface Actor {
  userId: string;
  userName: string;
  sessionId: string | null;
  tabId: string | null;
  userAgent: string | null;
}

export type CheckoffOutcome = "applied" | "no_change" | "not_found" | "service_changed";
export type CheckoffAction = "check" | "uncheck" | "reset" | "undo_reset";

/** Columns of checkoff_events filled for every entry; `affected` is added where it applies. */
export const EVENT_COLUMNS = "service_id, task_id, action, outcome, user_pco_id, user_name, session_id, tab_id, user_agent";

export const actorValues = (a: Actor) => [a.userId, a.userName, a.sessionId, a.tabId, a.userAgent] as const;

async function getActiveCheckoff(db: D1Database, serviceId: number, taskId: number): Promise<TaskCheckoff | null> {
  const row = await db
    .prepare(`SELECT checked_by_name, checked_at FROM checkoffs WHERE service_id = ? AND task_id = ? AND ${ACTIVE}`)
    .bind(serviceId, taskId)
    .first<{ checked_by_name: string; checked_at: string }>();
  return row ? { by: row.checked_by_name, at: row.checked_at } : null;
}

/**
 * Checks a task off for a service (US-06), snapshotting its text, department and section (US-13),
 * and logs the attempt in the same transaction. The task must be live in the service's list. If it is
 * already checked (by anyone), the existing check-off is kept. Returns null when the task is not part
 * of the service's checklist.
 */
export async function checkTask(
  db: D1Database,
  args: { serviceId: number; listId: number; taskId: number; actor: Actor },
): Promise<TaskCheckoff | null> {
  const { serviceId, listId, taskId, actor } = args;
  await db.batch([
    // OR IGNORE: the partial unique index allows one active check-off per task, so a second tap
    // (or two people at once) leaves the first one in place.
    db
      .prepare(
        `INSERT OR IGNORE INTO checkoffs
           (service_id, task_id, task_text_snapshot, category_id_snapshot, category_name_snapshot,
            section_id_snapshot, section_name_snapshot, checked_by_pco_id, checked_by_name)
         SELECT ?1, t.id, t.text, c.id, c.name, s.id, s.name, ?3, ?4
           FROM tasks t
           JOIN sections s ON s.id = t.section_id
           JOIN categories c ON c.id = s.category_id
          WHERE t.id = ?2 AND c.list_id = ?5
            AND t.deleted_at IS NULL AND s.deleted_at IS NULL AND c.deleted_at IS NULL`,
      )
      .bind(serviceId, taskId, actor.userId, actor.userName, listId),
    // changes() is the row count of the INSERT just above, in the same transaction.
    db
      .prepare(
        `INSERT INTO checkoff_events (${EVENT_COLUMNS})
         VALUES (?1, ?2, 'check',
           CASE WHEN changes() > 0 THEN 'applied'
                WHEN EXISTS (SELECT 1 FROM checkoffs WHERE service_id = ?1 AND task_id = ?2 AND ${ACTIVE}) THEN 'no_change'
                ELSE 'not_found' END,
           ?3, ?4, ?5, ?6, ?7)`,
      )
      .bind(serviceId, taskId, ...actorValues(actor)),
  ]);
  return getActiveCheckoff(db, serviceId, taskId);
}

/** Unchecks a task, recording who and when (US-06), and logs the attempt in the same transaction. */
export async function uncheckTask(db: D1Database, args: { serviceId: number; taskId: number; actor: Actor }): Promise<void> {
  const { serviceId, taskId, actor } = args;
  await db.batch([
    db
      .prepare(
        `UPDATE checkoffs
            SET unchecked_by_pco_id = ?3, unchecked_by_name = ?4,
                unchecked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE service_id = ?1 AND task_id = ?2 AND ${ACTIVE}`,
      )
      .bind(serviceId, taskId, actor.userId, actor.userName),
    db
      .prepare(
        `INSERT INTO checkoff_events (${EVENT_COLUMNS})
         VALUES (?1, ?2, 'uncheck', CASE WHEN changes() > 0 THEN 'applied' ELSE 'no_change' END, ?3, ?4, ?5, ?6, ?7)`,
      )
      .bind(serviceId, taskId, ...actorValues(actor)),
  ]);
}

/** Logs an attempt that was refused before touching check-offs (e.g. the service is no longer current). */
export async function logRejectedAttempt(
  db: D1Database,
  args: { serviceId: number; taskId: number | null; action: CheckoffAction; outcome: CheckoffOutcome; actor: Actor },
): Promise<void> {
  await db
    .prepare(`INSERT INTO checkoff_events (${EVENT_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`)
    .bind(args.serviceId, args.taskId, args.action, args.outcome, ...actorValues(args.actor))
    .run();
}
