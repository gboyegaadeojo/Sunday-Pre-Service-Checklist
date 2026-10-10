// App users (US-03a). Each person has an internal ID that never changes; sign-in accounts (Planning Center,
// local test users, later possibly Google) are linked to it in user_identities. Roles and every record of
// who did what refer to users.id, so changing sign-in providers never loses people, roles or history.

import type { ExternalIdentity } from "../sources/identity";

export interface User {
  /** Internal app user ID. */
  id: number;
  name: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  isDirector: boolean;
  teamVerifiedAt: string | null;
}

interface UserRow {
  id: number;
  display_name: string;
  avatar_url: string | null;
  is_admin: number;
  is_director: number;
  team_verified_at: string | null;
}

const toUser = (r: UserRow): User => ({
  id: r.id,
  name: r.display_name,
  avatarUrl: r.avatar_url,
  isAdmin: r.is_admin === 1,
  isDirector: r.is_director === 1,
  teamVerifiedAt: r.team_verified_at,
});

export async function getUser(db: D1Database, id: number): Promise<User | null> {
  const row = await db
    .prepare("SELECT id, display_name, avatar_url, is_admin, is_director, team_verified_at FROM users WHERE id = ?")
    .bind(id)
    .first<UserRow>();
  return row ? toUser(row) : null;
}

export interface SignIn {
  identity: ExternalIdentity;
  /** Result of the media-team membership check at sign-in (US-02). */
  onMediaTeam: boolean;
  /** Role flags applied only when the user is first created; later changes are made in-app (US-03). */
  initialRoles?: { isAdmin: boolean; isDirector: boolean };
}

/**
 * Signs in through a linked account: finds the user it belongs to, or creates the user and the link
 * together, all in one transaction. Refreshes name, avatar and team verification; never changes roles.
 * Returns the internal user ID.
 */
export async function signInWithIdentity(db: D1Database, { identity, onMediaTeam, initialRoles }: SignIn, nowIso: string): Promise<number> {
  const { provider, subject, name, avatarUrl, email } = identity;
  const verifiedAt = onMediaTeam ? nowIso : null;
  const linkedUser = "(SELECT user_id FROM user_identities WHERE provider = ?1 AND subject = ?2)";
  const results = await db.batch([
    // A new user only if this account isn't linked yet…
    db
      .prepare(
        `INSERT INTO users (display_name, avatar_url, is_admin, is_director, team_verified_at, last_seen_at)
         SELECT ?3, ?4, ?5, ?6, ?7, ?8 WHERE ${linkedUser} IS NULL`,
      )
      .bind(provider, subject, name, avatarUrl, initialRoles?.isAdmin ? 1 : 0, initialRoles?.isDirector ? 1 : 0, verifiedAt, nowIso),
    // …linked to it right away (changes() is the INSERT above, same transaction).
    db
      .prepare(
        `INSERT INTO user_identities (user_id, provider, subject, email, last_used_at)
         SELECT last_insert_rowid(), ?1, ?2, ?3, ?4 WHERE changes() = 1`,
      )
      .bind(provider, subject, email, nowIso),
    db
      .prepare(
        `UPDATE users SET display_name = ?3, avatar_url = ?4, team_verified_at = ?5, last_seen_at = ?6
          WHERE id = ${linkedUser}`,
      )
      .bind(provider, subject, name, avatarUrl, verifiedAt, nowIso),
    db
      .prepare("UPDATE user_identities SET last_used_at = ?3, email = COALESCE(?4, email) WHERE provider = ?1 AND subject = ?2")
      .bind(provider, subject, nowIso, email),
    db.prepare(`SELECT ${linkedUser} AS user_id`).bind(provider, subject),
  ]);
  const userId = (results[4].results[0] as { user_id: number | null } | undefined)?.user_id;
  if (typeof userId !== "number") throw new Error("Sign-in did not produce a user.");
  return userId;
}

export async function touchUser(db: D1Database, id: number, nowIso: string): Promise<void> {
  await db.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?").bind(nowIso, id).run();
}
