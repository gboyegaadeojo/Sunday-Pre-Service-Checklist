import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { ChecklistResponse } from "../src/shared/types";
import { request, signInAs, withCookie } from "./helpers";

let cookie: string;
const getChecklist = () => request("/api/checklist", withCookie(cookie));

// Undo any soft-deletes a test made, in case storage is shared between tests.
beforeEach(async () => {
  cookie = await signInAs("volunteer");
  await env.DB.batch([
    env.DB.prepare("UPDATE task_lists SET deleted_at = NULL, is_default = 1 WHERE id = 1"),
    env.DB.prepare("UPDATE categories SET deleted_at = NULL"),
    env.DB.prepare("UPDATE sections SET deleted_at = NULL"),
    env.DB.prepare("UPDATE tasks SET deleted_at = NULL"),
  ]);
});

describe("GET /api/checklist", () => {
  it("returns the seeded IFC checklist in order (US-14)", async () => {
    const res = await getChecklist();
    expect(res.status).toBe(200);
    const body = await res.json<ChecklistResponse>();

    expect(body.list.name).toBe("IFC Pre-Service Checklist");
    expect(body.categories.map((c) => c.name)).toEqual([
      "Presentation / Computer Graphics",
      "Audio Engineer",
      "Camera Operators",
      "Director (Switcher)",
      "Miscellaneous",
    ]);
    expect(body.categories.map((c) => c.sections.length)).toEqual([11, 7, 6, 6, 2]);
    expect(body.categories.map((c) => c.sections.reduce((n, s) => n + s.tasks.length, 0))).toEqual([
      43, 15, 13, 15, 7,
    ]);

    const first = body.categories[0].sections[0];
    expect(first.name).toBe("Power & Initial System Check");
    expect(first.tasks[0].text).toMatch(/^Verify all server rack devices/);
  });

  it("hides deleted categories, sections and tasks (US-12, US-12a, US-13)", async () => {
    await env.DB.batch([
      env.DB.prepare("UPDATE categories SET deleted_at = '2026-10-01T00:00:00Z' WHERE name = 'Miscellaneous'"),
      env.DB.prepare("UPDATE sections SET deleted_at = '2026-10-01T00:00:00Z' WHERE name = 'Communication' AND category_id = 2"),
      env.DB.prepare("UPDATE tasks SET deleted_at = '2026-10-01T00:00:00Z' WHERE text = 'Open ProPresenter'"),
    ]);

    const body = await (await getChecklist()).json<ChecklistResponse>();
    const names = body.categories.map((c) => c.name);
    expect(names).not.toContain("Miscellaneous");
    expect(body.categories[1].sections.map((s) => s.name)).not.toContain("Communication");
    const allTasks = body.categories.flatMap((c) => c.sections.flatMap((s) => s.tasks.map((t) => t.text)));
    expect(allTasks).not.toContain("Open ProPresenter");
  });

  it("keeps a category whose sections are all deleted, with no sections", async () => {
    await env.DB.prepare("UPDATE sections SET deleted_at = '2026-10-01T00:00:00Z' WHERE category_id = 5").run();
    const body = await (await getChecklist()).json<ChecklistResponse>();
    expect(body.categories[4]).toMatchObject({ name: "Miscellaneous", sections: [] });
  });

  it("returns 404 with a message when there is no default list", async () => {
    await env.DB.prepare("UPDATE task_lists SET is_default = 0").run();
    const res = await getChecklist();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "No default checklist is set up yet." });
  });
});

describe("unknown API routes", () => {
  it("return JSON 404", async () => {
    const res = await request("/api/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });
});
