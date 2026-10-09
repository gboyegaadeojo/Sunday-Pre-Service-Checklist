// "Everything is editable" (CLAUDE.md): church content and structure come from the database,
// and the app copes with any shape of checklist.
import { env } from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";
import type { BrandingResponse, ChecklistResponse } from "../src/shared/types";
import { request, signInAs, withCookie } from "./helpers";

describe("settings seed", () => {
  it("seeds a valid time zone and service weekday (US-07)", async () => {
    const rows = await env.DB.prepare("SELECT key, value FROM settings WHERE key IN ('time_zone', 'service_weekday')").all<{
      key: string;
      value: string;
    }>();
    const s = Object.fromEntries(rows.results.map((r) => [r.key, r.value]));
    expect(s).toEqual({ time_zone: "America/Winnipeg", service_weekday: "0" });
    expect(() => new Intl.DateTimeFormat("en-CA", { timeZone: s.time_zone })).not.toThrow();
  });
});

describe("GET /api/branding", () => {
  const original = new Map<string, string>();

  afterEach(async () => {
    for (const [key, value] of original) {
      await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").bind(key, value).run();
    }
    original.clear();
  });

  const change = async (key: string, value: string | null) => {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{ value: string }>();
    if (row && !original.has(key)) original.set(key, row.value);
    if (value === null) await env.DB.prepare("DELETE FROM settings WHERE key = ?").bind(key).run();
    else await env.DB.prepare("UPDATE settings SET value = ? WHERE key = ?").bind(value, key).run();
  };

  it("is public and returns the seeded branding", async () => {
    const res = await request("/api/branding");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ shortName: "IFC", teamName: "IFC Production", appName: "Pre-Service Checklist" });
  });

  it("reflects edits to the settings table", async () => {
    await change("team_name", "Grace Media");
    await change("church_short_name", null);
    expect(await (await request("/api/branding")).json<BrandingResponse>()).toEqual({
      shortName: null,
      teamName: "Grace Media",
      appName: "Pre-Service Checklist",
    });
  });

  it("exposes only branding, not other settings", async () => {
    const body = await (await request("/api/branding")).json<Record<string, unknown>>();
    expect(Object.keys(body).sort()).toEqual(["appName", "shortName", "teamName"]);
  });
});

describe("checklist of any shape", () => {
  afterEach(async () => {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM tasks WHERE section_id IN (SELECT s.id FROM sections s JOIN categories c ON c.id = s.category_id WHERE c.list_id = 99)"),
      env.DB.prepare("DELETE FROM sections WHERE category_id IN (SELECT id FROM categories WHERE list_id = 99)"),
      env.DB.prepare("DELETE FROM categories WHERE list_id = 99"),
      env.DB.prepare("DELETE FROM task_lists WHERE id = 99"),
      env.DB.prepare("UPDATE task_lists SET is_default = 1 WHERE id = 1"),
    ]);
  });

  it("returns 25 departments including empty ones, a 60-task section and long names, in order", async () => {
    const longName = `Department ${"VeryLongUnbrokenName".repeat(8)}`;
    const stmts = [
      env.DB.prepare("UPDATE task_lists SET is_default = 0 WHERE id = 1"),
      env.DB.prepare("INSERT INTO task_lists (id, name, is_default) VALUES (99, 'Generated list', 1)"),
    ];
    for (let d = 1; d <= 25; d++) {
      const catId = 9000 + d;
      // Insert in reverse sort order to prove ordering comes from sort_order, not insertion.
      stmts.push(
        env.DB.prepare("INSERT INTO categories (id, list_id, name, sort_order) VALUES (?, 99, ?, ?)").bind(
          catId,
          d === 3 ? longName : `Department ${d}`,
          26 - d,
        ),
      );
      if (d === 1) continue; // department with no sections
      const secId = 90000 + d;
      stmts.push(env.DB.prepare("INSERT INTO sections (id, category_id, name, sort_order) VALUES (?, ?, 'Only section', 1)").bind(secId, catId));
      const taskCount = d === 2 ? 0 : d === 4 ? 60 : 2; // department 2 has an empty section
      for (let t = 1; t <= taskCount; t++) {
        stmts.push(env.DB.prepare("INSERT INTO tasks (section_id, text, sort_order) VALUES (?, ?, ?)").bind(secId, `Task ${t}`, t));
      }
    }
    await env.DB.batch(stmts);

    const res = await request("/api/checklist", withCookie(await signInAs("volunteer")));
    expect(res.status).toBe(200);
    const body = await res.json<ChecklistResponse>();
    expect(body.list.name).toBe("Generated list");
    expect(body.categories).toHaveLength(25);
    expect(body.categories[0].name).toBe("Department 25");
    expect(body.categories.at(-1)).toMatchObject({ name: "Department 1", sections: [] });
    expect(body.categories.find((c) => c.name === "Department 2")?.sections[0].tasks).toEqual([]);
    expect(body.categories.find((c) => c.name === "Department 4")?.sections[0].tasks).toHaveLength(60);
    expect(body.categories.some((c) => c.name === longName)).toBe(true);
  });
});
