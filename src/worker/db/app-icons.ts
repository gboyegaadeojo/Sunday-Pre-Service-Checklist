// App icons (Stage 13, requirements C42): made from the logo mark (the short name in white on the purple) in an Admin's
// browser and stored here (migration 0013), so the Worker only ever serves bytes: no drawing within the Free plan's
// CPU limit. Icons count only while they show the current short name; otherwise the neutral icon is served.

import type { AppIconName } from "../../shared/types";
import { getSettings } from "./settings";

/** The current short name, and when icons showing it were made (null: none, or they show an older short name). */
export async function appIconsStatus(db: D1Database): Promise<{ shortName: string; updatedAt: string | null }> {
  const { church_short_name } = await getSettings(db, ["church_short_name"]);
  const shortName = (church_short_name ?? "").trim();
  if (!shortName) return { shortName, updatedAt: null };
  const row = await db
    .prepare("SELECT MIN(updated_at) AS updated_at, COUNT(*) AS n FROM app_icons WHERE short_name = ?")
    .bind(shortName)
    .first<{ updated_at: string | null; n: number }>();
  return { shortName, updatedAt: row && row.n === 4 ? row.updated_at : null };
}

/** One icon's PNG, if a current one is stored (see appIconsStatus). */
export async function getAppIcon(db: D1Database, name: AppIconName): Promise<ArrayBuffer | null> {
  const row = await db
    .prepare(
      `SELECT png FROM app_icons
        WHERE name = ?1 AND short_name = (SELECT TRIM(value) FROM settings WHERE key = 'church_short_name') AND short_name <> ''`,
    )
    .bind(name)
    .first<{ png: ArrayBuffer | number[] }>();
  if (!row) return null;
  return row.png instanceof ArrayBuffer ? row.png : new Uint8Array(row.png).buffer;
}

/** Replaces all four icons in one batch. */
export async function saveAppIcons(db: D1Database, shortName: string, icons: Record<AppIconName, Uint8Array>): Promise<void> {
  await db.batch(
    Object.entries(icons).map(([name, png]) =>
      db
        .prepare(
          `INSERT INTO app_icons (name, png, short_name) VALUES (?1, ?2, ?3)
           ON CONFLICT (name) DO UPDATE SET png = excluded.png, short_name = excluded.short_name,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
        )
        .bind(name, png, shortName),
    ),
  );
}
