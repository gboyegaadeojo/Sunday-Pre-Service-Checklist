// Admin and Director roles (Stage 6, US-03). Roles change only here, in the app; sign-in never changes them
// (db/users.ts). Every change is logged to the append-only role_events table in the same transaction: the log
// row is written first, carrying every guard, and the change runs only if it was (changes() = 1).

import type { RoleEditsResponse, RoleField, UpdateRolesRequest, UserSummary, UsersResponse } from "../../shared/types";
import { type Actor, actorValues } from "./checkoffs";
import { getSettings } from "./settings";

const COLUMN: Record<RoleField, string> = { isAdmin: "is_admin", isDirector: "is_director" };
const FIELDS = Object.keys(COLUMN) as RoleField[];

interface UserRow {
  id: number;
  display_name: string;
  avatar_url: string | null;
  is_admin: number;
  is_director: number;
  team_verified_at: string | null;
  last_seen_at: string | null;
}

/** Everyone who has signed in, by name. Sign-in provider IDs are never included (US-03a). */
export async function getUsers(db: D1Database): Promise<UsersResponse> {
  const { time_zone: timeZone } = await getSettings(db, ["time_zone"]);
  if (!timeZone) throw new Error("The time_zone setting is missing.");
  const { results } = await db
    .prepare(
      `SELECT id, display_name, avatar_url, is_admin, is_director, team_verified_at, last_seen_at
         FROM users ORDER BY display_name COLLATE NOCASE, id`,
    )
    .all<UserRow>();
  return {
    timeZone,
    users: results.map(
      (r): UserSummary => ({
        id: r.id,
        name: r.display_name,
        avatarUrl: r.avatar_url,
        isAdmin: r.is_admin === 1,
        isDirector: r.is_director === 1,
        onMediaTeam: r.team_verified_at !== null,
        lastSeenAt: r.last_seen_at,
      }),
    ),
  };
}

export type SetRolesResult = { ok: true; changed: RoleField[] } | { ok: false; reason: "not_found" | "last_admin" | "conflict" };

/**
 * Sets a person's Admin and Director roles, logging only what changed. Refuses to take Admin from the last Admin,
 * so the app can never be left without one. "conflict": their roles changed since they were read; try again.
 * Takes effect on that person's next request: roles are re-read from the database every time (US-03).
 */
export async function setRoles(db: D1Database, actor: Actor, userId: number, next: UpdateRolesRequest): Promise<SetRolesResult> {
  const row = await db.prepare("SELECT is_admin, is_director FROM users WHERE id = ?").bind(userId).first<{ is_admin: number; is_director: number }>();
  if (!row) return { ok: false, reason: "not_found" };
  const current: UpdateRolesRequest = { isAdmin: row.is_admin === 1, isDirector: row.is_director === 1 };
  const changed = FIELDS.filter((f) => current[f] !== next[f]);
  if (changed.length === 0) return { ok: true, changed };

  const pick = (values: UpdateRolesRequest) => JSON.stringify(Object.fromEntries(changed.map((f) => [f, values[f]])));
  // ?1 user, ?2/?3 the roles as read, ?4/?5 the new roles, ?6/?7 the log's before/after; the actor is ?21–?25.
  // The log row's guard refuses removing the last Admin; the users_keep_an_admin trigger (migration 0009) backs it
  // up, aborting the whole batch (log row included) if a concurrent change got there first.
  const batch = db.batch([
    db
      .prepare(
        `INSERT INTO role_events (target_user_id, target_name, before_json, after_json, user_id, user_name, session_id, tab_id, user_agent)
         SELECT u.id, u.display_name, ?6, ?7, ?21, ?22, ?23, ?24, ?25 FROM users u
          WHERE u.id = ?1 AND u.is_admin = ?2 AND u.is_director = ?3
            AND NOT (?4 = 0 AND u.is_admin = 1 AND NOT EXISTS (SELECT 1 FROM users o WHERE o.is_admin = 1 AND o.id <> u.id))`,
      )
      .bind(userId, row.is_admin, row.is_director, next.isAdmin ? 1 : 0, next.isDirector ? 1 : 0, pick(current), pick(next), ...Array(13).fill(null), ...actorValues(actor)),
    db
      .prepare("UPDATE users SET is_admin = ?2, is_director = ?3 WHERE id = ?1 AND changes() = 1")
      .bind(userId, next.isAdmin ? 1 : 0, next.isDirector ? 1 : 0),
  ]);
  let logged: D1Result;
  try {
    [logged] = await batch;
  } catch (err) {
    if (/at least one Admin/.test(String(err))) return { ok: false, reason: "last_admin" };
    throw err;
  }
  if (logged.meta.changes === 1) return { ok: true, changed };

  // Not saved: say why.
  const now = await db
    .prepare(
      `SELECT is_admin, is_director, (SELECT COUNT(*) FROM users WHERE is_admin = 1 AND id <> ?1) AS other_admins
         FROM users WHERE id = ?1`,
    )
    .bind(userId)
    .first<{ is_admin: number; is_director: number; other_admins: number }>();
  if (!now) return { ok: false, reason: "not_found" };
  if (!next.isAdmin && now.is_admin === 1 && now.other_admins === 0) return { ok: false, reason: "last_admin" };
  return { ok: false, reason: "conflict" };
}

const EVENTS_PAGE = 500;

/** The role log, newest first (Admins only). */
export async function getRoleEvents(db: D1Database): Promise<RoleEditsResponse> {
  const { results } = await db
    .prepare(
      `SELECT id, created_at, target_name, before_json, after_json, user_name, session_id, tab_id
         FROM role_events ORDER BY id DESC LIMIT ?1`,
    )
    .bind(EVENTS_PAGE + 1)
    .all<{
      id: number;
      created_at: string;
      target_name: string;
      before_json: string;
      after_json: string;
      user_name: string;
      session_id: string | null;
      tab_id: string | null;
    }>();
  return {
    events: results.slice(0, EVENTS_PAGE).map((r) => ({
      id: r.id,
      at: r.created_at,
      target: r.target_name,
      before: JSON.parse(r.before_json),
      after: JSON.parse(r.after_json),
      user: r.user_name,
      sessionId: r.session_id,
      tabId: r.tab_id,
    })),
    truncated: results.length > EVENTS_PAGE,
  };
}
