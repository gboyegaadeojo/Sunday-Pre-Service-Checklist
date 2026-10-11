// Scheduled Director (Stage 12, requirements C41): people scheduled in a position an Admin marked "Gets the Director
// role while scheduled" are Directors for the current service period only. Roles never come from the schedule source
// on its own: only marked positions grant, only Director (never Admin), and permanent Directors (users.is_director,
// set on Users & Permissions) are untouched.
//
// - Matching (C38): the source gives a scheduled person's position by name, matched to one of the team's positions,
//   whose ID finds the link and its switch. Someone still carrying a position's old name after a rename matches
//   nothing (positionExternalId null) and isn't granted.
// - A grant (scheduled_directors) belongs to one service and counts only while that service is the current one, so it
//   ends by itself when the next service becomes current. syncScheduledDirectors records the end (ended_at, and the
//   role log) when it next runs, and ends a grant sooner when the person is no longer scheduled in a marked position.
// - Outages (US-04a): if the source can't be reached, nothing is granted or ended; the last successful check stands.
// - Every grant and end is logged in role_events (append-only) in the same batch, by the schedule rather than an Admin.

import type { DirectorGrant } from "../../shared/types";
import { ProviderUnavailableError } from "../sources/identity";
import { PERSON_PROVIDER, type PlanAssignment, type ScheduleSource } from "../sources/schedule";
import { getServiceTypeId, planAssignments } from "./mapping";
import { currentServiceDay, getCurrentService } from "./services";
import type { User } from "./users";

export type DirectorSync = "synced" | "unavailable" | "skipped";

/** Who the role log shows as making automatic changes: the schedule, never a person. */
const SYSTEM_USER_ID = 0;
const systemName = (source: ScheduleSource) => `${source.label} schedule`;

/**
 * Brings the grants in line with the current service's plan (run on each page load, GET /api/auth/me): grants for
 * people newly scheduled in a marked position, ends for those no longer scheduled there, and ends for grants from
 * services that are no longer current. "unavailable": the source couldn't be reached, so nothing changed.
 * "skipped": no source or no Service Type chosen yet.
 */
export async function syncScheduledDirectors(db: D1Database, source: ScheduleSource | null, now: Date): Promise<DirectorSync> {
  if (!source || !(await getServiceTypeId(db, source))) return "skipped";
  const service = await getCurrentService(db, now, source);
  if (!service) return "skipped";
  if (service.scheduleUnavailable) return "unavailable";

  // No plan published means nobody is scheduled (the source answered); an unreachable source changes nothing.
  let scheduled: PlanAssignment[] = [];
  if (service.planExternalId) {
    try {
      scheduled = await planAssignments(db, source, service.planExternalId);
    } catch (err) {
      if (!(err instanceof ProviderUnavailableError)) throw err;
      return "unavailable";
    }
  }
  const subjects = [...new Set(scheduled.filter((a) => a.positionExternalId !== null).map((a) => a.person))];

  const [markedResult, peopleResult, openResult] = await db.batch([
    db
      .prepare(
        "SELECT team_external_id, position_external_id, team_name, position_name FROM team_links WHERE source = ?1 AND grants_director = 1 AND position_external_id IS NOT NULL",
      )
      .bind(source.id),
    // Their app accounts, by their ID in the source (their sign-in subject). Admins are never granted.
    db
      .prepare(
        `SELECT ui.subject, u.id FROM user_identities ui JOIN users u ON u.id = ui.user_id
          WHERE ui.provider = ?1 AND u.is_admin = 0 AND ui.subject IN (SELECT value FROM json_each(?2))`,
      )
      .bind(PERSON_PROVIDER[source.id], JSON.stringify(subjects)),
    db.prepare("SELECT id, service_id, user_id FROM scheduled_directors WHERE ended_at IS NULL"),
  ]);
  const marked = markedResult.results as { team_external_id: string; position_external_id: string; team_name: string; position_name: string }[];
  const people = peopleResult.results as { subject: string; id: number }[];
  const open = openResult.results as { id: number; service_id: number; user_id: number }[];

  // Who should hold a grant for this service, and through which position (the first one found).
  const wanted = new Map<number, { team: string; position: string; name: string }>();
  for (const a of scheduled) {
    if (a.positionExternalId === null) continue; // a position name that matches nothing (C38, C39)
    const link = marked.find((l) => l.team_external_id === a.teamExternalId && l.position_external_id === a.positionExternalId);
    const userId = people.find((p) => p.subject === a.person)?.id;
    if (!link || userId === undefined || wanted.has(userId)) continue;
    // Named as on the link (what Team mapping shows), not as the plan happens to spell it.
    wanted.set(userId, { team: a.teamExternalId, position: a.positionExternalId, name: `${link.team_name} › ${link.position_name}` });
  }

  const nowIso = now.toISOString();
  const statements: D1PreparedStatement[] = [];
  // Ends: log first (only if the grant is still open), then close it.
  const end = (grantId: number, reason: "service_over" | "not_scheduled") =>
    statements.push(
      db
        .prepare(
          `INSERT INTO role_events (target_user_id, target_name, before_json, after_json, user_id, user_name)
           SELECT g.user_id, u.display_name,
                  json_object('scheduledDirector', json_object('position', g.position_name, 'serviceDate', s.service_date)),
                  json_object('scheduledDirector', json('null'), 'reason', ?2), ?3, ?4
             FROM scheduled_directors g JOIN users u ON u.id = g.user_id JOIN services s ON s.id = g.service_id
            WHERE g.id = ?1 AND g.ended_at IS NULL`,
        )
        .bind(grantId, reason, SYSTEM_USER_ID, systemName(source)),
      db.prepare("UPDATE scheduled_directors SET ended_at = ?2 WHERE id = ?1 AND ended_at IS NULL AND changes() = 1").bind(grantId, nowIso),
    );
  for (const g of open) {
    if (g.service_id !== service.id) end(g.id, "service_over");
    else if (!wanted.has(g.user_id)) end(g.id, "not_scheduled");
  }
  // Grants: insert (one open grant per person and service, so a concurrent check can't double it), then log it.
  for (const [userId, w] of wanted) {
    if (open.some((g) => g.service_id === service.id && g.user_id === userId)) continue;
    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO scheduled_directors (service_id, user_id, source, team_external_id, position_external_id, position_name)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
        )
        .bind(service.id, userId, source.id, w.team, w.position, w.name),
      db
        .prepare(
          `INSERT INTO role_events (target_user_id, target_name, before_json, after_json, user_id, user_name)
           SELECT u.id, u.display_name, json_object('scheduledDirector', json('null')),
                  json_object('scheduledDirector', json_object('position', ?2, 'serviceDate', ?3)), ?4, ?5
             FROM users u WHERE u.id = ?1 AND changes() = 1`,
        )
        .bind(userId, w.name, service.date, SYSTEM_USER_ID, systemName(source)),
    );
  }
  if (statements.length > 0) await db.batch(statements);
  return "synced";
}

/** The person's grant for the current service, if any (an open grant from another service no longer counts). */
export async function activeDirectorGrant(db: D1Database, userId: number, now: Date): Promise<DirectorGrant | null> {
  const { results } = await db
    .prepare(
      `SELECT g.position_name, s.service_date FROM scheduled_directors g JOIN services s ON s.id = g.service_id
        WHERE g.user_id = ? AND g.ended_at IS NULL`,
    )
    .bind(userId)
    .all<{ position_name: string; service_date: string }>();
  if (results.length === 0) return null; // most people: one query, no date work
  const { date } = await currentServiceDay(db, now);
  const grant = results.find((r) => r.service_date === date);
  return grant ? { position: grant.position_name, serviceDate: grant.service_date } : null;
}

/**
 * The user with any scheduled Director role applied: Director for the current service while they hold a grant
 * (requirements C41). Admins and permanent Directors are returned as they are. Every role check reads isDirector, so
 * the server enforces the grant on every request like any other role.
 */
export async function withScheduledDirector(db: D1Database, user: User, now: Date): Promise<User> {
  if (user.isAdmin || user.isDirector) return user;
  const grant = await activeDirectorGrant(db, user.id, now);
  return grant ? { ...user, isDirector: true, scheduledDirector: grant } : user;
}
