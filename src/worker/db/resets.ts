import type { ResetInfo } from "../../shared/types";
import { ACTIVE, type Actor, EVENT_COLUMNS, actorValues, logRejectedAttempt } from "./checkoffs";

interface ResetRow {
  id: number;
  reset_at: string;
  reset_by_name: string;
  archived_count: number;
  undone_at: string | null;
  undone_by_name: string | null;
}

/** The service's latest reset, or null if it was never reset. Only the latest can be undone (US-07). */
export async function getLatestReset(db: D1Database, serviceId: number): Promise<ResetInfo | null> {
  const row = await db
    .prepare(
      `SELECT id, reset_at, reset_by_name, archived_count, undone_at, undone_by_name
         FROM resets WHERE service_id = ? ORDER BY id DESC LIMIT 1`,
    )
    .bind(serviceId)
    .first<ResetRow>();
  if (!row) return null;
  return {
    id: row.id,
    at: row.reset_at,
    by: row.reset_by_name,
    archived: row.archived_count,
    undoneAt: row.undone_at,
    undoneBy: row.undone_by_name,
    canUndo: row.undone_at === null,
  };
}

export type ResetResult = { ok: true; affected: number } | { ok: false; reason: "nothing_to_reset" | "nothing_to_undo" };

/**
 * Resets a service checklist (US-07): archives every active check-off under a new reset, in one
 * transaction with its log entry. Refuses when nothing is checked, so an extra reset can never take
 * away the chance to undo the real one.
 */
export async function resetService(db: D1Database, serviceId: number, actor: Actor): Promise<ResetResult> {
  const active = await db
    .prepare(`SELECT COUNT(*) AS n FROM checkoffs WHERE service_id = ? AND ${ACTIVE}`)
    .bind(serviceId)
    .first<{ n: number }>();
  if (!active?.n) {
    await logRejectedAttempt(db, { serviceId, taskId: null, action: "reset", outcome: "no_change", actor });
    return { ok: false, reason: "nothing_to_reset" };
  }

  const [, archive] = await db.batch([
    db.prepare("INSERT INTO resets (service_id, reset_by_pco_id, reset_by_name) VALUES (?, ?, ?)").bind(serviceId, actor.userId, actor.userName),
    // The reset just inserted is the newest for this service (same transaction).
    db
      .prepare(
        `UPDATE checkoffs SET reset_id = (SELECT MAX(id) FROM resets WHERE service_id = ?1)
          WHERE service_id = ?1 AND ${ACTIVE}`,
      )
      .bind(serviceId),
    db
      .prepare(`INSERT INTO checkoff_events (${EVENT_COLUMNS}, affected) VALUES (?1, NULL, 'reset', 'applied', ?2, ?3, ?4, ?5, ?6, changes())`)
      .bind(serviceId, ...actorValues(actor)),
    // Copy the count from the log entry just written (last_insert_rowid() is that entry).
    db
      .prepare(
        `UPDATE resets SET archived_count = (SELECT affected FROM checkoff_events WHERE id = last_insert_rowid())
          WHERE id = (SELECT MAX(id) FROM resets WHERE service_id = ?1)`,
      )
      .bind(serviceId),
  ]);
  return { ok: true, affected: archive.meta.changes };
}

/**
 * Undoes the latest reset of a service (US-07). Restores its archived check-offs, except for tasks that
 * were checked again after the reset: the newer check-off wins (decision D3, Q18).
 */
export async function undoLatestReset(db: D1Database, serviceId: number, actor: Actor): Promise<ResetResult> {
  const latest = await getLatestReset(db, serviceId);
  if (!latest?.canUndo) {
    await logRejectedAttempt(db, { serviceId, taskId: null, action: "undo_reset", outcome: "no_change", actor });
    return { ok: false, reason: "nothing_to_undo" };
  }

  const [restore] = await db.batch([
    db
      .prepare(
        `UPDATE checkoffs SET reset_id = NULL
          WHERE reset_id = ?1
            AND task_id NOT IN (SELECT task_id FROM checkoffs WHERE service_id = ?2 AND ${ACTIVE})`,
      )
      .bind(latest.id, serviceId),
    db
      .prepare(`INSERT INTO checkoff_events (${EVENT_COLUMNS}, affected) VALUES (?1, NULL, 'undo_reset', 'applied', ?2, ?3, ?4, ?5, ?6, changes())`)
      .bind(serviceId, ...actorValues(actor)),
    db
      .prepare(
        `UPDATE resets SET undone_by_pco_id = ?2, undone_by_name = ?3, undone_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = ?1 AND undone_at IS NULL`,
      )
      .bind(latest.id, actor.userId, actor.userName),
  ]);
  return { ok: true, affected: restore.meta.changes };
}
