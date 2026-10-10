// Short-lived schedule-source responses in D1 (source_cache), so the app stays fast and doesn't hit the source's
// rate limits (Architecture Note). Not the Workers Cache API: it does nothing on *.workers.dev (build plan §1).
//
// Every source call goes through here, so this is also where outages are handled (US-04a, Stage 7c): a call that
// fails or takes longer than SOURCE_TIMEOUT_MS throws ProviderUnavailableError, and the source is then treated as
// unreachable for UNAVAILABLE_SECONDS without being asked again, so pages don't each wait out the timeout on a
// Sunday morning. "Refresh from Planning Center" (clearCache) forgets that and asks again.

import { ProviderUnavailableError } from "./identity";

/** How long a cached response is used: a few minutes (Architecture Note). */
export const CACHE_SECONDS = 5 * 60;

/** A source call that takes longer than this counts as the source being down (US-04a: within 5 seconds). */
export const SOURCE_TIMEOUT_MS = 5000;

/** After a failure, how long the source is treated as unreachable without asking it again. */
export const UNAVAILABLE_SECONDS = 60;

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/** `promise`, or ProviderUnavailableError once `ms` have passed. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ProviderUnavailableError(`No answer within ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** The source's "unreachable" marker key: keys start with the source's ID ("fake:teams:…"). */
const unavailableKey = (key: string) => `${key.split(":")[0]}:unavailable`;

/**
 * The cached value for `key`, or `load()`'s result, stored for `seconds`. Errors are never cached as values; a
 * failure or timeout marks the source unreachable for a minute, and throws ProviderUnavailableError meanwhile.
 */
export async function cached<T>(db: D1Database, key: string, load: () => Promise<T>, seconds = CACHE_SECONDS): Promise<T> {
  const { results } = await db
    .prepare(`SELECT key, json FROM source_cache WHERE key IN (?1, ?2) AND expires_at > ${NOW}`)
    .bind(key, unavailableKey(key))
    .all<{ key: string; json: string }>();
  const hit = results.find((r) => r.key === key);
  if (hit) return JSON.parse(hit.json) as T;
  if (results.length > 0) throw new ProviderUnavailableError("The source was unreachable a moment ago");

  let value: T;
  try {
    value = await withTimeout(load(), SOURCE_TIMEOUT_MS);
  } catch (err) {
    if (!(err instanceof ProviderUnavailableError)) throw err;
    await store(db, unavailableKey(key), true, UNAVAILABLE_SECONDS);
    throw err;
  }
  await store(db, key, value, seconds);
  return value;
}

const store = (db: D1Database, key: string, value: unknown, seconds: number) =>
  db
    .prepare(
      `INSERT INTO source_cache (key, json, expires_at) VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+' || ?3 || ' seconds'))
       ON CONFLICT (key) DO UPDATE SET json = excluded.json, expires_at = excluded.expires_at`,
    )
    .bind(key, JSON.stringify(value), seconds)
    .run();

/** Forgets every cached response whose key starts with `prefix` (e.g. "planning_center:"), and any outage marker. */
export const clearCache = (db: D1Database, prefix: string) =>
  db.prepare("DELETE FROM source_cache WHERE substr(key, 1, length(?1)) = ?1").bind(prefix).run();
