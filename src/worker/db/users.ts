export interface User {
  id: string; // Planning Center person ID
  name: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  isDirector: boolean;
  teamVerifiedAt: string | null;
}

interface UserRow {
  pco_person_id: string;
  display_name: string;
  avatar_url: string | null;
  is_admin: number;
  is_director: number;
  team_verified_at: string | null;
}

const toUser = (r: UserRow): User => ({
  id: r.pco_person_id,
  name: r.display_name,
  avatarUrl: r.avatar_url,
  isAdmin: r.is_admin === 1,
  isDirector: r.is_director === 1,
  teamVerifiedAt: r.team_verified_at,
});

export async function getUser(db: D1Database, id: string): Promise<User | null> {
  const row = await db
    .prepare(
      `SELECT pco_person_id, display_name, avatar_url, is_admin, is_director, team_verified_at
         FROM users WHERE pco_person_id = ?`,
    )
    .bind(id)
    .first<UserRow>();
  return row ? toUser(row) : null;
}

export interface SignInIdentity {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** Result of the media-team membership check at sign-in (US-02). */
  onMediaTeam: boolean;
  /** Role flags applied only when the user row is first created; later changes are made in-app (US-03). */
  initialRoles?: { isAdmin: boolean; isDirector: boolean };
}

/** Create or refresh the user at sign-in. Existing role flags are never overwritten here. */
export async function upsertSignedInUser(db: D1Database, identity: SignInIdentity, nowIso: string): Promise<void> {
  const verifiedAt = identity.onMediaTeam ? nowIso : null;
  await db
    .prepare(
      `INSERT INTO users (pco_person_id, display_name, avatar_url, is_admin, is_director, team_verified_at, last_seen_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
       ON CONFLICT (pco_person_id) DO UPDATE SET
         display_name = excluded.display_name,
         avatar_url = excluded.avatar_url,
         team_verified_at = excluded.team_verified_at,
         last_seen_at = excluded.last_seen_at`,
    )
    .bind(
      identity.id,
      identity.name,
      identity.avatarUrl,
      identity.initialRoles?.isAdmin ? 1 : 0,
      identity.initialRoles?.isDirector ? 1 : 0,
      verifiedAt,
      nowIso,
    )
    .run();
}

export async function touchUser(db: D1Database, id: string, nowIso: string): Promise<void> {
  await db.prepare("UPDATE users SET last_seen_at = ? WHERE pco_person_id = ?").bind(nowIso, id).run();
}
