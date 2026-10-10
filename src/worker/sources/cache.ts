// Short-lived schedule-source responses in D1 (source_cache), so the app stays fast and doesn't hit the source's
// rate limits (Architecture Note). Not the Workers Cache API: it does nothing on *.workers.dev (build plan §1).

/** How long a cached response is used: a few minutes (Architecture Note). */
export const CACHE_SECONDS = 5 * 60;

/** The cached value for `key`, or `load()`'s result, stored for `seconds`. Errors from `load` are never cached. */
export async function cached<T>(db: D1Database, key: string, load: () => Promise<T>, seconds = CACHE_SECONDS): Promise<T> {
  const hit = await db
    .prepare("SELECT json FROM source_cache WHERE key = ? AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')")
    .bind(key)
    .first<{ json: string }>();
  if (hit) return JSON.parse(hit.json) as T;
  const value = await load();
  await db
    .prepare(
      `INSERT INTO source_cache (key, json, expires_at) VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+' || ?3 || ' seconds'))
       ON CONFLICT (key) DO UPDATE SET json = excluded.json, expires_at = excluded.expires_at`,
    )
    .bind(key, JSON.stringify(value), seconds)
    .run();
  return value;
}

/** Forgets every cached response whose key starts with `prefix` (e.g. "planning_center:"). */
export const clearCache = (db: D1Database, prefix: string) =>
  db.prepare("DELETE FROM source_cache WHERE substr(key, 1, length(?1)) = ?1").bind(prefix).run();
