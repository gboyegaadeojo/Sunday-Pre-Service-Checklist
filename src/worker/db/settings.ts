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
