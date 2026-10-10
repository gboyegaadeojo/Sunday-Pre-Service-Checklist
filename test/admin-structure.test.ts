// Stage 5a: admins add, rename/edit and hide departments, sections and tasks (US-12, US-12a, US-13).
// Uses its own list (ID 77) as the default so the seed checklist is untouched (see admin-fixture.ts).
import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { CreatedResponse } from "../src/shared/types";
import { D1, D2, LIST, S_A, S_B, T_ALPHA, T_BETA, adminList, api, checklist, cookies, names, setUpAdminFixture } from "./admin-fixture";
import { request, withCookie } from "./helpers";

setUpAdminFixture();

describe("access", () => {
  it("is Admin only, on every endpoint", async () => {
    const calls: [string, string, unknown?][] = [
      ["GET", "/lists/default"],
      ["POST", `/lists/${LIST}/categories`, { name: "X" }],
      ["POST", `/categories/${D1}/sections`, { name: "X" }],
      ["POST", `/sections/${S_A}/tasks`, { text: "X" }],
      ["PATCH", `/categories/${D1}`, { name: "X" }],
      ["PATCH", `/sections/${S_A}`, { name: "X" }],
      ["PATCH", `/tasks/${T_ALPHA}`, { text: "X" }],
      ["DELETE", `/categories/${D1}`],
      ["DELETE", `/sections/${S_A}`],
      ["DELETE", `/tasks/${T_ALPHA}`],
    ];
    for (const [method, path, body] of calls) {
      expect((await api(cookies.director, method, path, body)).status, `${method} ${path} as Director`).toBe(403);
      expect((await api(cookies.volunteer, method, path, body)).status, `${method} ${path} as Volunteer`).toBe(403);
      expect((await request(`/api/admin${path}`, { method })).status, `${method} ${path} signed out`).toBe(401);
    }
    expect(names(await adminList())).toEqual(["Dept One", "Dept Two"]); // nothing changed
  });
});

describe("reading the list", () => {
  it("returns the default list's live structure with Planning Center link counts", async () => {
    const list = await adminList();
    expect(list.list).toMatchObject({ id: LIST, name: "Test list", isDefault: true });
    expect(list.categories.map((c) => [c.name, c.linkCount, c.sections.map((s) => s.tasks.map((t) => t.text))])).toEqual([
      ["Dept One", 2, [["Alpha", "Beta"], ["Gamma"]]],
      ["Dept Two", 0, []],
    ]);
  });
});

describe("adding", () => {
  it("adds departments, sections and tasks at the end, live for everyone at once", async () => {
    const dept = await api(cookies.admin, "POST", `/lists/${LIST}/categories`, { name: "  Lighting  " });
    expect(dept.status).toBe(201);
    const { id: deptId } = await dept.json<CreatedResponse>();
    const { id: secId } = await (await api(cookies.admin, "POST", `/categories/${deptId}/sections`, { name: "Before Service" })).json<CreatedResponse>();
    await api(cookies.admin, "POST", `/sections/${secId}/tasks`, { text: "Turn on the haze machine" });
    await api(cookies.admin, "POST", `/sections/${S_A}/tasks`, { text: "Delta" });

    const cl = await checklist();
    expect(names(cl)).toEqual(["Dept One", "Dept Two", "Lighting"]); // trimmed, at the end
    expect(cl.categories[2].sections[0]).toMatchObject({ name: "Before Service", tasks: [{ text: "Turn on the haze machine" }] });
    expect(cl.categories[0].sections[0].tasks.map((t) => t.text)).toEqual(["Alpha", "Beta", "Delta"]);
  });

  it("accepts any wording, including non-English text", async () => {
    const res = await api(cookies.admin, "POST", `/lists/${LIST}/categories`, { name: "Équipe Vidéo — 映像" });
    expect(res.status).toBe(201);
    expect(names(await adminList())).toContain("Équipe Vidéo — 映像");
  });

  it("refuses to add into a hidden parent", async () => {
    await api(cookies.admin, "DELETE", `/sections/${S_B}`);
    expect((await api(cookies.admin, "POST", `/sections/${S_B}/tasks`, { text: "X" })).status).toBe(404);
    await api(cookies.admin, "DELETE", `/categories/${D2}`);
    expect((await api(cookies.admin, "POST", `/categories/${D2}/sections`, { name: "X" })).status).toBe(404);
  });
});

describe("validation", () => {
  it.each([
    [{ name: "" }, "Name can't be empty."],
    [{ name: "   " }, "Name can't be empty."],
    [{}, "Name can't be empty."],
    [{ name: 42 }, "Name can't be empty."],
    [{ name: "x".repeat(121) }, "Name can be at most 120 characters."],
  ])("rejects %j", async (body, error) => {
    const res = await api(cookies.admin, "PATCH", `/categories/${D1}`, body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
  });

  it("limits task text to 500 characters", async () => {
    expect((await api(cookies.admin, "PATCH", `/tasks/${T_ALPHA}`, { text: "x".repeat(501) })).status).toBe(400);
    expect((await api(cookies.admin, "PATCH", `/tasks/${T_ALPHA}`, { text: "x".repeat(500) })).status).toBe(204);
  });

  it("returns 404 for unknown or malformed IDs", async () => {
    expect((await api(cookies.admin, "PATCH", "/tasks/999999", { text: "X" })).status).toBe(404);
    expect((await api(cookies.admin, "PATCH", "/tasks/abc", { text: "X" })).status).toBe(404);
    expect((await api(cookies.admin, "DELETE", "/categories/0")).status).toBe(404);
  });
});

describe("renaming and editing, with history kept (US-13)", () => {
  it("renames everywhere at once, while past check-offs keep the names and text from check-off time", async () => {
    const { service } = await checklist();
    await request(`/api/services/${service.id}/tasks/${T_ALPHA}/checkoff`, { method: "PUT", ...withCookie(cookies.volunteer) });

    expect((await api(cookies.admin, "PATCH", `/categories/${D1}`, { name: "Dept Uno" })).status).toBe(204);
    await api(cookies.admin, "PATCH", `/sections/${S_A}`, { name: "Sec Alpha" });
    await api(cookies.admin, "PATCH", `/tasks/${T_ALPHA}`, { text: "Alpha (revised)" });

    const cl = await checklist();
    expect(cl.categories[0]).toMatchObject({ name: "Dept Uno", sections: [{ name: "Sec Alpha" }, { name: "Sec B" }] });
    const task = cl.categories[0].sections[0].tasks[0];
    expect(task.text).toBe("Alpha (revised)");
    expect(task.checkoff?.by).toBe("Test Volunteer"); // still checked: the check-off stays linked

    expect(await env.DB.prepare("SELECT task_text_snapshot, category_name_snapshot, section_name_snapshot FROM checkoffs").first()).toEqual({
      task_text_snapshot: "Alpha",
      category_name_snapshot: "Dept One",
      section_name_snapshot: "Sec A",
    });
  });
});

describe("hiding (never erasing)", () => {
  it("hides a task: gone from the checklist, kept in the database with its check-offs", async () => {
    const { service } = await checklist();
    await request(`/api/services/${service.id}/tasks/${T_BETA}/checkoff`, { method: "PUT", ...withCookie(cookies.volunteer) });
    expect((await api(cookies.admin, "DELETE", `/tasks/${T_BETA}`)).status).toBe(204);

    expect((await checklist()).categories[0].sections[0].tasks.map((t) => t.text)).toEqual(["Alpha"]);
    expect(await env.DB.prepare(`SELECT text, deleted_at IS NOT NULL AS hidden FROM tasks WHERE id = ${T_BETA}`).first()).toEqual({
      text: "Beta",
      hidden: 1,
    });
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM checkoffs").first<{ n: number }>())?.n).toBe(1);
    expect((await api(cookies.admin, "DELETE", `/tasks/${T_BETA}`)).status).toBe(404); // already hidden
  });

  it("hides a section and everything in it", async () => {
    await api(cookies.admin, "DELETE", `/sections/${S_A}`);
    expect((await checklist()).categories[0].sections.map((s) => s.name)).toEqual(["Sec B"]);
    expect((await api(cookies.admin, "PATCH", `/tasks/${T_ALPHA}`, { text: "X" })).status).toBe(404); // inside a hidden section
    expect((await env.DB.prepare(`SELECT COUNT(*) AS n FROM tasks WHERE section_id = ${S_A}`).first<{ n: number }>())?.n).toBe(2);
  });

  it("hides a department and removes its Planning Center links (US-12)", async () => {
    expect((await api(cookies.admin, "DELETE", `/categories/${D1}`)).status).toBe(204);
    expect(names(await checklist())).toEqual(["Dept Two"]);
    expect(names(await adminList())).toEqual(["Dept Two"]);
    expect((await env.DB.prepare(`SELECT COUNT(*) AS n FROM team_links WHERE category_id = ${D1}`).first<{ n: number }>())?.n).toBe(0);
    expect((await env.DB.prepare(`SELECT COUNT(*) AS n FROM sections WHERE category_id = ${D1}`).first<{ n: number }>())?.n).toBe(2);
  });

  it("leaves Planning Center links alone when the department was already hidden", async () => {
    await env.DB.prepare(`UPDATE categories SET deleted_at = '2026-10-01T00:00:00Z' WHERE id = ${D1}`).run();
    expect((await api(cookies.admin, "DELETE", `/categories/${D1}`)).status).toBe(404);
    expect((await env.DB.prepare(`SELECT COUNT(*) AS n FROM team_links WHERE category_id = ${D1}`).first<{ n: number }>())?.n).toBe(2);
  });
});
