// Stage 5b: moving and reordering (US-12, US-12a, US-13) and restoring hidden items (US-13a).
// Uses its own list (ID 77) as the default so the seed checklist is untouched (see admin-fixture.ts).
import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { ApiErrorBody, HiddenItemsResponse } from "../src/shared/types";
import { D1, D2, LIST, S_A, S_B, T_ALPHA, T_BETA, T_GAMMA, adminList, api, checklist, cookies, names, setUpAdminFixture } from "./admin-fixture";
import { request, withCookie } from "./helpers";

setUpAdminFixture();

const admin = (method: string, path: string, body?: unknown) => api(cookies.admin, method, path, body);
const hidden = async () => (await (await admin("GET", "/lists/default/hidden")).json()) as HiddenItemsResponse;
const check = async (taskId: number) => {
  const { service } = await checklist();
  await request(`/api/services/${service.id}/tasks/${taskId}/checkoff`, { method: "PUT", ...withCookie(cookies.volunteer) });
};
/** Task texts per section, per department, as the volunteer's checklist shows them. */
const shape = async () =>
  (await checklist()).categories.map((c) => [c.name, c.sections.map((s) => [s.name, s.tasks.map((t) => t.text)])]);

describe("access", () => {
  it("is Admin only, on every endpoint", async () => {
    const calls: [string, string, unknown?][] = [
      ["GET", "/lists/default/hidden"],
      ["POST", `/categories/${D1}/reorder`, { direction: "down" }],
      ["POST", `/sections/${S_A}/reorder`, { direction: "down" }],
      ["POST", `/tasks/${T_ALPHA}/reorder`, { direction: "down" }],
      ["POST", `/tasks/${T_ALPHA}/move`, { sectionId: S_B }],
      ["POST", `/sections/${S_A}/move`, { categoryId: D2 }],
      ["POST", `/categories/${D1}/restore`, {}],
      ["POST", `/sections/${S_A}/restore`, {}],
      ["POST", `/tasks/${T_ALPHA}/restore`, {}],
    ];
    await env.DB.prepare(`UPDATE tasks SET deleted_at = '2026-10-01T00:00:00Z' WHERE id = ${T_ALPHA}`).run();
    for (const [method, path, body] of calls) {
      expect((await api(cookies.director, method, path, body)).status, `${method} ${path} as Director`).toBe(403);
      expect((await api(cookies.volunteer, method, path, body)).status, `${method} ${path} as Volunteer`).toBe(403);
      expect((await request(`/api/admin${path}`, { method })).status, `${method} ${path} signed out`).toBe(401);
    }
    expect(await shape()).toEqual([
      ["Dept One", [["Sec A", ["Beta"]], ["Sec B", ["Gamma"]]]],
      ["Dept Two", []],
    ]); // nothing changed
  });
});

describe("reordering", () => {
  it("moves departments, sections and tasks up and down", async () => {
    expect((await admin("POST", `/categories/${D2}/reorder`, { direction: "up" })).status).toBe(204);
    expect((await admin("POST", `/sections/${S_A}/reorder`, { direction: "down" })).status).toBe(204);
    expect((await admin("POST", `/tasks/${T_BETA}/reorder`, { direction: "up" })).status).toBe(204);
    expect(await shape()).toEqual([
      ["Dept Two", []],
      ["Dept One", [["Sec B", ["Gamma"]], ["Sec A", ["Beta", "Alpha"]]]],
    ]);
  });

  it("refuses to move past either end", async () => {
    const res = await admin("POST", `/tasks/${T_ALPHA}/reorder`, { direction: "up" });
    expect(res.status).toBe(409);
    expect(((await res.json()) as ApiErrorBody).error).toBe("It's already first.");
    expect((await admin("POST", `/categories/${D2}/reorder`, { direction: "down" })).status).toBe(409);
  });

  it("skips hidden siblings, which keep their place for a later restore", async () => {
    await admin("POST", `/sections/${S_A}/tasks`, { text: "Delta" }); // Alpha, Beta, Delta
    await admin("DELETE", `/tasks/${T_BETA}`);
    await admin("POST", `/tasks/${T_ALPHA}/reorder`, { direction: "down" }); // past hidden Beta
    expect((await shape())[0][1][0]).toEqual(["Sec A", ["Delta", "Alpha"]]);
    await admin("POST", `/tasks/${T_BETA}/restore`);
    expect((await shape())[0][1][0]).toEqual(["Sec A", ["Delta", "Beta", "Alpha"]]);
  });

  it("validates the request", async () => {
    expect((await admin("POST", `/tasks/${T_ALPHA}/reorder`, { direction: "sideways" })).status).toBe(400);
    expect((await admin("POST", `/tasks/${T_ALPHA}/reorder`)).status).toBe(400);
    expect((await admin("POST", "/tasks/999999/reorder", { direction: "down" })).status).toBe(404);
    await admin("DELETE", `/tasks/${T_ALPHA}`);
    expect((await admin("POST", `/tasks/${T_ALPHA}/reorder`, { direction: "down" })).status).toBe(404); // hidden
  });
});

describe("moving a task (US-13)", () => {
  it("moves to the end of a section in another department and stays checked; the record keeps where it was", async () => {
    const { id: s2 } = (await (await admin("POST", `/categories/${D2}/sections`, { name: "Sec C" })).json()) as { id: number };
    await admin("POST", `/sections/${s2}/tasks`, { text: "Epsilon" });
    await check(T_ALPHA);

    expect((await admin("POST", `/tasks/${T_ALPHA}/move`, { sectionId: s2 })).status).toBe(204);

    const cl = await checklist();
    expect(cl.categories[0].sections[0].tasks.map((t) => t.text)).toEqual(["Beta"]);
    expect(cl.categories[1].sections[0].tasks.map((t) => [t.text, t.checkoff?.by ?? null])).toEqual([
      ["Epsilon", null],
      ["Alpha", "Test Volunteer"],
    ]);
    expect(await env.DB.prepare("SELECT category_name_snapshot, section_name_snapshot FROM checkoffs").first()).toEqual({
      category_name_snapshot: "Dept One",
      section_name_snapshot: "Sec A",
    });
  });

  it("refuses hidden destinations, other lists, the same section, and bad input", async () => {
    await admin("DELETE", `/sections/${S_B}`);
    expect((await admin("POST", `/tasks/${T_ALPHA}/move`, { sectionId: S_B })).status).toBe(404);
    expect((await admin("POST", `/tasks/${T_ALPHA}/move`, { sectionId: 1 })).status).toBe(404); // seed list section
    expect((await admin("POST", `/tasks/${T_ALPHA}/move`, { sectionId: S_A })).status).toBe(400);
    expect((await admin("POST", `/tasks/${T_ALPHA}/move`, { sectionId: "x" })).status).toBe(400);
    expect((await admin("POST", `/tasks/${T_ALPHA}/move`, {})).status).toBe(400);
    expect((await admin("POST", `/tasks/${T_GAMMA}/move`, { sectionId: S_A })).status).toBe(404); // inside the hidden section
    expect(await env.DB.prepare(`SELECT section_id FROM tasks WHERE id = ${T_ALPHA}`).first()).toEqual({ section_id: S_A });
  });
});

describe("moving a section (US-12a)", () => {
  it("moves with all its tasks to the end of another department", async () => {
    await admin("POST", `/categories/${D2}/sections`, { name: "Existing" });
    expect((await admin("POST", `/sections/${S_A}/move`, { categoryId: D2 })).status).toBe(204);
    expect(await shape()).toEqual([
      ["Dept One", [["Sec B", ["Gamma"]]]],
      ["Dept Two", [["Existing", []], ["Sec A", ["Alpha", "Beta"]]]],
    ]);
  });

  it("refuses hidden departments, other lists and the same department", async () => {
    await admin("DELETE", `/categories/${D2}`);
    expect((await admin("POST", `/sections/${S_A}/move`, { categoryId: D2 })).status).toBe(404);
    expect((await admin("POST", `/sections/${S_A}/move`, { categoryId: 1 })).status).toBe(404); // seed list department
    expect((await admin("POST", `/sections/${S_A}/move`, { categoryId: D1 })).status).toBe(400);
    expect(await env.DB.prepare(`SELECT category_id FROM sections WHERE id = ${S_A}`).first()).toEqual({ category_id: D1 });
  });
});

describe("hidden items (US-13a)", () => {
  it("lists items hidden on their own, newest first, with where they sit and what comes back with them", async () => {
    await env.DB.batch([
      env.DB.prepare(`UPDATE tasks SET deleted_at = '2026-10-01T10:00:00.000Z' WHERE id = ${T_BETA}`),
      env.DB.prepare(`UPDATE sections SET deleted_at = '2026-10-02T10:00:00.000Z' WHERE id = ${S_B}`),
      env.DB.prepare(`UPDATE categories SET deleted_at = '2026-10-03T10:00:00.000Z' WHERE id = ${D1}`),
    ]);
    const res = await hidden();
    expect(res.list).toEqual({ id: LIST, name: "Test list" });
    expect(res.timeZone).toBe("America/Winnipeg");
    expect(res.items).toEqual([
      { kind: "category", id: D1, name: "Dept One", hiddenAt: "2026-10-03T10:00:00.000Z", sectionCount: 1, taskCount: 1 },
      {
        kind: "section",
        id: S_B,
        name: "Sec B",
        hiddenAt: "2026-10-02T10:00:00.000Z",
        category: { id: D1, name: "Dept One", hidden: true },
        taskCount: 1,
      },
      {
        kind: "task",
        id: T_BETA,
        name: "Beta",
        hiddenAt: "2026-10-01T10:00:00.000Z",
        category: { id: D1, name: "Dept One", hidden: true },
        section: { id: S_A, name: "Sec A", hidden: false },
      },
    ]);
  });

  it("is empty when nothing is hidden, and never includes other lists", async () => {
    await env.DB.prepare("UPDATE tasks SET deleted_at = '2026-10-01T00:00:00Z' WHERE id = 1").run(); // seed list
    expect((await hidden()).items).toEqual([]);
    await env.DB.prepare("UPDATE tasks SET deleted_at = NULL WHERE id = 1").run();
  });
});

describe("restoring (US-13a)", () => {
  it("brings a task back in its old place, still checked for the current service", async () => {
    await check(T_ALPHA);
    await admin("DELETE", `/tasks/${T_ALPHA}`);
    expect((await admin("POST", `/tasks/${T_ALPHA}/restore`)).status).toBe(204);
    const task = (await checklist()).categories[0].sections[0].tasks[0];
    expect([task.text, task.checkoff?.by]).toEqual(["Alpha", "Test Volunteer"]);
    expect((await hidden()).items).toEqual([]);
    expect((await admin("POST", `/tasks/${T_ALPHA}/restore`)).status).toBe(404); // not hidden anymore
  });

  it("brings a department back with everything not hidden on its own, but not its Planning Center links", async () => {
    await admin("DELETE", `/sections/${S_B}`);
    await admin("DELETE", `/categories/${D1}`);
    expect((await admin("POST", `/categories/${D1}/restore`)).status).toBe(204);
    expect(await shape()).toEqual([
      ["Dept One", [["Sec A", ["Alpha", "Beta"]]]],
      ["Dept Two", []],
    ]);
    expect((await hidden()).items.map((i) => i.name)).toEqual(["Sec B"]);
    expect((await env.DB.prepare(`SELECT COUNT(*) AS n FROM team_links WHERE category_id = ${D1}`).first<{ n: number }>())?.n).toBe(0);
  });

  it("won't restore into a hidden parent unless asked to restore the parents too", async () => {
    await admin("DELETE", `/tasks/${T_BETA}`);
    await admin("DELETE", `/sections/${S_A}`);
    await admin("DELETE", `/categories/${D1}`);

    const refused = await admin("POST", `/tasks/${T_BETA}/restore`, {});
    expect(refused.status).toBe(409);
    expect(((await refused.json()) as ApiErrorBody).code).toBe("parent_hidden");
    expect((await hidden()).items).toHaveLength(3); // nothing changed

    expect((await admin("POST", `/tasks/${T_BETA}/restore`, { withParents: true })).status).toBe(204);
    expect(await shape()).toEqual([
      ["Dept One", [["Sec A", ["Alpha", "Beta"]], ["Sec B", ["Gamma"]]]],
      ["Dept Two", []],
    ]);
  });

  it("restores only the hidden parents, leaving a live one alone", async () => {
    await admin("DELETE", `/sections/${S_B}`);
    await admin("DELETE", `/categories/${D1}`);
    expect((await admin("POST", `/sections/${S_B}/restore`, { withParents: true })).status).toBe(204);
    expect(names(await adminList())).toEqual(["Dept One", "Dept Two"]);
    expect((await hidden()).items).toEqual([]);
  });

  it("returns 404 for unknown or live items", async () => {
    expect((await admin("POST", "/tasks/999999/restore")).status).toBe(404);
    expect((await admin("POST", `/sections/${S_A}/restore`, { withParents: true })).status).toBe(404);
    expect((await admin("POST", `/categories/${D2}/restore`)).status).toBe(404);
  });
});
