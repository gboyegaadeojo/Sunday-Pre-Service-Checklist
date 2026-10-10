import type { ChurchSettings, SettingField, SettingsEditsResponse } from "../../shared/types";
import { type Actor, actorValues } from "./checkoffs";

/** Church-specific settings. Values live in the `settings` table and are edited by admins; never default them in code. */
export type SettingKey = "church_short_name" | "team_name" | "app_name" | "time_zone" | "service_weekday";

/** The requested settings; a key with no row maps to null. */
export async function getSettings<K extends SettingKey>(db: D1Database, keys: readonly K[]): Promise<Record<K, string | null>> {
  const placeholders = keys.map(() => "?").join(", ");
  const { results } = await db
    .prepare(`SELECT key, value FROM settings WHERE key IN (${placeholders})`)
    .bind(...keys)
    .all<{ key: K; value: string }>();
  const values = Object.fromEntries(keys.map((k) => [k, null])) as Record<K, string | null>;
  for (const row of results) values[row.key] = row.value;
  return values;
}

// Settings screen (Stage 5d.2, US-11a) ------------------------------------------------------------------

/** Each field of the Settings screen and the row that stores it, in display order. */
const FIELD_KEY: Record<SettingField, SettingKey> = {
  timeZone: "time_zone",
  serviceWeekday: "service_weekday",
  shortName: "church_short_name",
  teamName: "team_name",
  appName: "app_name",
};
const FIELDS = Object.keys(FIELD_KEY) as SettingField[];

/** How each field is stored (text) and read back in SQL (the weekday as a number). */
const stored = (value: ChurchSettings[SettingField]) => (value === null ? null : String(value));
const readSql = (field: SettingField) => {
  const value = `(SELECT value FROM settings WHERE key = '${FIELD_KEY[field]}')`;
  return field === "serviceWeekday" ? `CAST(${value} AS INTEGER)` : value;
};

/** All settings as the Settings screen edits them. Missing rows read as empty, so an admin can fill them in. */
export async function getChurchSettings(db: D1Database): Promise<ChurchSettings> {
  const s = await getSettings(db, Object.values(FIELD_KEY));
  const weekday = s.service_weekday;
  return {
    timeZone: s.time_zone ?? "",
    serviceWeekday: weekday !== null && /^[0-6]$/.test(weekday) ? Number(weekday) : null,
    shortName: s.church_short_name ?? "",
    teamName: s.team_name ?? "",
    appName: s.app_name ?? "",
  };
}

/**
 * Saves the settings that differ from what's stored, and logs them to settings_events in the same
 * transaction. Log first: the log row reads the before values and is written only if a value still differs;
 * each setting is then written only if the log row was (`changes() = 1`, and each upsert changes one row, so
 * the chain holds). Returns the fields that changed; none means nothing was written or logged.
 */
export async function updateChurchSettings(db: D1Database, actor: Actor, next: ChurchSettings): Promise<SettingField[]> {
  const current = await getChurchSettings(db);
  const changed = FIELDS.filter((f) => stored(current[f]) !== stored(next[f]));
  if (changed.length === 0) return [];

  // ?1… are the new values of the changed fields, in order; the actor is ?21–?25.
  const pairs = (value: (f: SettingField, i: number) => string) => changed.map((f, i) => `'${f}', ${value(f, i)}`).join(", ");
  const newValue = (f: SettingField, i: number) => (f === "serviceWeekday" ? `CAST(?${i + 1} AS INTEGER)` : `?${i + 1}`);
  const values = changed.map((f) => stored(next[f]));
  const log = db
    .prepare(
      `INSERT INTO settings_events (before_json, after_json, user_id, user_name, session_id, tab_id, user_agent)
       SELECT json_object(${pairs(readSql)}), json_object(${pairs(newValue)}), ?21, ?22, ?23, ?24, ?25
        WHERE ${changed.map((f, i) => `(SELECT value FROM settings WHERE key = '${FIELD_KEY[f]}') IS NOT ?${i + 1}`).join(" OR ")}`,
    )
    .bind(...values, ...Array(20 - values.length).fill(null), ...actorValues(actor));
  const writes = changed.map((f, i) =>
    db
      .prepare(
        `INSERT INTO settings (key, value) SELECT '${FIELD_KEY[f]}', ?1 WHERE changes() = 1
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      )
      .bind(values[i]),
  );
  const [logged] = await db.batch([log, ...writes]);
  return logged.meta.changes === 1 ? changed : [];
}

const EVENTS_PAGE = 500;

/** The settings log, newest first (Admins only). */
export async function getSettingsEvents(db: D1Database): Promise<SettingsEditsResponse> {
  const { results } = await db
    .prepare(
      `SELECT id, created_at, before_json, after_json, user_name, session_id, tab_id
         FROM settings_events ORDER BY id DESC LIMIT ?1`,
    )
    .bind(EVENTS_PAGE + 1)
    .all<{ id: number; created_at: string; before_json: string; after_json: string; user_name: string; session_id: string | null; tab_id: string | null }>();
  return {
    events: results.slice(0, EVENTS_PAGE).map((r) => ({
      id: r.id,
      at: r.created_at,
      before: JSON.parse(r.before_json),
      after: JSON.parse(r.after_json),
      user: r.user_name,
      sessionId: r.session_id,
      tabId: r.tab_id,
    })),
    truncated: results.length > EVENTS_PAGE,
  };
}
