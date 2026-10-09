// Stage 5a: admins add, rename/edit and hide departments, sections and tasks (US-12, US-12a, US-13).
// Uses its own list (ID 77) as the default so the seed checklist is untouched.
import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AdminListResponse, ChecklistResponse, CreatedResponse } from "../src/shared/types";
import { request, signInAs, withCookie } from "./helpers";

let admin: string;
let director: string;
let volunteer: string;

const LIST = 77;
const D1 = 7701; // "Dept One": sections 77011 (Alpha, Beta) and 77012 (Gamma); 2 Planning Center links
const D2 = 7702; // "Dept Two": no sections
const S_A = 77011;
const S_B = 77012;
const T_ALPHA = 770111;
const T_BETA = 770112;

const inList = `SELECT id FROM categories WHERE list_id = ${LIST}`;
async function clearList() {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM checkoffs"),
    env.DB.prepare("DELETE FROM resets"),
    env.DB.prepare("DELETE FROM services"),
    env.DB.prepare(`DELETE FROM team_links WHERE category_id IN (${inList})`),
    env.DB.prepare(`DELETE FROM tasks WHERE section_id IN (SELECT id FROM sections WHERE category_id IN (${inList}))`),
    env.DB.prepare(`DELETE FROM sections WHERE category_id IN (${inList})`),
    env.DB.prepare(`DELETE FROM categories WHERE list_id = ${LIST}`),
    env.DB.prepare(`DELETE FROM task_lists WHERE id = ${LIST}`),
    env.DB.prepare("UPDATE task_lists SET is_default = 1 WHERE id = 1"),
  ]);
}

beforeEach(async () => {
  await clearList();
  await env.DB.batch([
    env.DB.prepare("UPDATE task_lists SET is_default = 0 WHERE id = 1"),
    env.DB.prepare(`INSERT INTO task_lists (id, name, is_default) VALUES (${LIST}, 'Test list', 1)`),
    env.DB.prepare(`INSERT INTO categories (id, list_id, name, sort_order) VALUES (${D1}, ${LIST}, 'Dept One', 1), (${D2}, ${LIST}, 'Dept Two', 2)`),
    env.DB.prepare(`INSERT INTO sections (id, category_id, name, sort_order) VALUES (${S_A}, ${D1}, 'Sec A', 1), (${S_B}, ${D1}, 'Sec B', 2)`),
    env.DB.prepare(
      `INSERT INTO tasks (id, section_id, text, sort_order) VALUES (${T_ALPHA}, ${S_A}, 'Alpha', 1), (${T_BETA}, ${S_A}, 'Beta', 2), (770121, ${S_B}, 'Gamma', 1)`,
    ),
    env.DB.prepare(
      `INSERT INTO team_links (pco_team_id, pco_position_id, category_id, pco_team_name) VALUES ('t1', NULL, ${D1}, 'Team 1'), ('t2', 'p1', ${D1}, 'Team 2')`,
    ),
  ]);
  [admin, director, volunteer] = await Promise.all([signInAs("admin"), signInAs("director"), signInAs("volunteer")]);
});

afterEach(clearList);

const api = (cookie: string, method: string, path: string, body?: unknown) =>
  request(`/api/admin${path}`, {
    method,
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const adminList = async () => (await (await api(admin, "GET", "/lists/default")).json()) as AdminListResponse;
const checklist = async () => (await request("/api/checklist", withCookie(volunteer))).json<ChecklistResponse>();
const names = (l: { categories: { name: string }[] }) => l.categories.map((c) => c.name);

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
      expect((await api(director, method, path, body)).status, `${method} ${path} as Director`).toBe(403);
      expect((await api(volunteer, method, path, body)).status, `${method} ${path} as Volunteer`).toBe(403);
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
    const dept = await api(admin, "POST", `/lists/${LIST}/categories`, { name: "  Lighting  " });
    expect(dept.status).toBe(201);
    const { id: deptId } = await dept.json<CreatedResponse>();
    const { id: secId } = await (await api(admin, "POST", `/categories/${deptId}/sections`, { name: "Before Service" })).json<CreatedResponse>();
    await api(admin, "POST", `/sections/${secId}/tasks`, { text: "Turn on the haze machine" });
    await api(admin, "POST", `/sections/${S_A}/tasks`, { text: "Delta" });

    const cl = await checklist();
    expect(names(cl)).toEqual(["Dept One", "Dept Two", "Lighting"]); // trimmed, at the end
    expect(cl.categories[2].sections[0]).toMatchObject({ name: "Before Service", tasks: [{ text: "Turn on the haze machine" }] });
    expect(cl.categories[0].sections[0].tasks.map((t) => t.text)).toEqual(["Alpha", "Beta", "Delta"]);
  });

  it("accepts any wording, including non-English text", async () => {
    const res = await api(admin, "POST", `/lists/${LIST}/categories`, { name: "Équipe Vidéo — 映像" });
    expect(res.status).toBe(201);
    expect(names(await adminList())).toContain("Équipe Vidéo — 映像");
  });

  it("refuses to add into a hidden parent", async () => {
    await api(admin, "DELETE", `/sections/${S_B}`);
    expect((await api(admin, "POST", `/sections/${S_B}/tasks`, { text: "X" })).status).toBe(404);
    await api(admin, "DELETE", `/categories/${D2}`);
    expect((await api(admin, "POST", `/categories/${D2}/sections`, { name: "X" })).status).toBe(404);
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
    const res = await api(admin, "PATCH", `/categories/${D1}`, body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
  });

  it("limits task text to 500 characters", async () => {
    expect((await api(admin, "PATCH", `/tasks/${T_ALPHA}`, { text: "x".repeat(501) })).status).toBe(400);
    expect((await api(admin, "PATCH", `/tasks/${T_ALPHA}`, { text: "x".repeat(500) })).status).toBe(204);
  });

  it("returns 404 for unknown or malformed IDs", async () => {
    expect((await api(admin, "PATCH", "/tasks/999999", { text: "X" })).status).toBe(404);
    expect((await api(admin, "PATCH", "/tasks/abc", { text: "X" })).status).toBe(404);
    expect((await api(admin, "DELETE", "/categories/0")).status).toBe(404);
  });
});

describe("renaming and editing, with history kept (US-13)", () => {
  it("renames everywhere at once, while past check-offs keep the names and text from check-off time", async () => {
    const { service } = await checklist();
    await request(`/api/services/${service.id}/tasks/${T_ALPHA}/checkoff`, { method: "PUT", ...withCookie(volunteer) });

    expect((await api(admin, "PATCH", `/categories/${D1}`, { name: "Dept Uno" })).status).toBe(204);
    await api(admin, "PATCH", `/sections/${S_A}`, { name: "Sec Alpha" });
    await api(admin, "PATCH", `/tasks/${T_ALPHA}`, { text: "Alpha (revised)" });

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
    await request(`/api/services/${service.id}/tasks/${T_BETA}/checkoff`, { method: "PUT", ...withCookie(volunteer) });
    expect((await api(admin, "DELETE", `/tasks/${T_BETA}`)).status).toBe(204);

    expect((await checklist()).categories[0].sections[0].tasks.map((t) => t.text)).toEqual(["Alpha"]);
    expect(await env.DB.prepare(`SELECT text, deleted_at IS NOT NULL AS hidden FROM tasks WHERE id = ${T_BETA}`).first()).toEqual({
      text: "Beta",
      hidden: 1,
    });
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM checkoffs").first<{ n: number }>())?.n).toBe(1);
    expect((await api(admin, "DELETE", `/tasks/${T_BETA}`)).status).toBe(404); // already hidden
  });

  it("hides a section and everything in it", async () => {
    await api(admin, "DELETE", `/sections/${S_A}`);
    expect((await checklist()).categories[0].sections.map((s) => s.name)).toEqual(["Sec B"]);
    expect((await api(admin, "PATCH", `/tasks/${T_ALPHA}`, { text: "X" })).status).toBe(404); // inside a hidden section
    expect((await env.DB.prepare(`SELECT COUNT(*) AS n FROM tasks WHERE section_id = ${S_A}`).first<{ n: number }>())?.n).toBe(2);
  });

  it("hides a department and removes its Planning Center links (US-12)", async () => {
    expect((await api(admin, "DELETE", `/categories/${D1}`)).status).toBe(204);
    expect(names(await checklist())).toEqual(["Dept Two"]);
    expect(names(await adminList())).toEqual(["Dept Two"]);
    expect((await env.DB.prepare(`SELECT COUNT(*) AS n FROM team_links WHERE category_id = ${D1}`).first<{ n: number }>())?.n).toBe(0);
    expect((await env.DB.prepare(`SELECT COUNT(*) AS n FROM sections WHERE category_id = ${D1}`).first<{ n: number }>())?.n).toBe(2);
  });

  it("leaves Planning Center links alone when the department was already hidden", async () => {
    await env.DB.prepare(`UPDATE categories SET deleted_at = '2026-10-01T00:00:00Z' WHERE id = ${D1}`).run();
    expect((await api(admin, "DELETE", `/categories/${D1}`)).status).toBe(404);
    expect((await env.DB.prepare(`SELECT COUNT(*) AS n FROM team_links WHERE category_id = ${D1}`).first<{ n: number }>())?.n).toBe(2);
  });
});
