// Stage 5d.1: task lists (US-11). Create (empty or as a copy), rename/describe, set the default (optionally
// switching the current service), hide and restore, every change logged (US-13b). The fixture's list 77 is
// the default; the seed list (1) is another live list. Lists created here are removed after each test.
import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AdminListResponse, ApiErrorBody, ChecklistEditEvent, ChecklistEditsResponse, CreatedResponse, ListsResponse } from "../src/shared/types";
import { D1, LIST, S_B, T_BETA, api, checklist, cookies, setUpAdminFixture } from "./admin-fixture";
import { request, withCookie } from "./helpers";

setUpAdminFixture();

const admin = (method: string, path: string, body?: unknown) => api(cookies.admin, method, path, body);
const lists = async () => (await (await admin("GET", "/lists")).json()) as ListsResponse;
const create = async (body: unknown) => ((await (await admin("POST", "/lists", body)).json()) as CreatedResponse).id;
const structure = async (id: number) => {
  const l = (await (await admin("GET", `/lists/${id}`)).json()) as AdminListResponse;
  return l.categories.map((c) => [c.name, c.sections.map((s) => [s.name, s.tasks.map((t) => t.text)])]);
};

let marker: number;
beforeEach(async () => {
  marker = (await env.DB.prepare("SELECT COALESCE(MAX(id), 0) AS id FROM checklist_events").first<{ id: number }>())?.id ?? 0;
});
/** This test's list entries in the edit log, oldest first. */
const listEdits = async (): Promise<ChecklistEditEvent[]> =>
  ((await (await admin("GET", "/edits")).json()) as ChecklistEditsResponse).events.filter((e) => e.id > marker && e.kind === "list").reverse();

// Remove lists this file created (IDs above the fixture's), and the default back on list 77.
afterEach(async () => {
  const mine = "SELECT id FROM task_lists WHERE id > 77";
  const cats = `SELECT id FROM categories WHERE list_id IN (${mine})`;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM checkoffs"),
    env.DB.prepare("DELETE FROM resets"),
    env.DB.prepare("DELETE FROM services"),
    env.DB.prepare(`DELETE FROM tasks WHERE section_id IN (SELECT id FROM sections WHERE category_id IN (${cats}))`),
    env.DB.prepare(`DELETE FROM sections WHERE category_id IN (${cats})`),
    env.DB.prepare(`DELETE FROM categories WHERE list_id IN (${mine})`),
    env.DB.prepare(`DELETE FROM task_lists WHERE id IN (${mine})`),
    env.DB.prepare("UPDATE task_lists SET is_default = 0, deleted_at = NULL WHERE id = 1"),
  ]);
});

describe("access", () => {
  it("is Admin only, on every endpoint", async () => {
    const calls: [string, string, unknown?][] = [
      ["GET", "/lists"],
      ["POST", "/lists", { name: "X" }],
      ["PATCH", "/lists/1", { name: "X" }],
      ["POST", "/lists/1/default", {}],
      ["DELETE", "/lists/1"],
      ["POST", "/lists/1/restore"],
      ["GET", "/edits"],
    ];
    for (const [method, path, body] of calls) {
      expect((await api(cookies.director, method, path, body)).status, `${method} ${path} as Director`).toBe(403);
      expect((await api(cookies.volunteer, method, path, body)).status, `${method} ${path} as Volunteer`).toBe(403);
      expect((await request(`/api/admin${path}`, { method })).status, `${method} ${path} signed out`).toBe(401);
    }
  });
});

describe("listing", () => {
  it("shows the default first, with counts and the current service's list", async () => {
    await checklist(); // creates the current service from the default list
    const res = await lists();
    expect(res.lists[0]).toMatchObject({ id: LIST, name: "Test list", isDefault: true, departmentCount: 2, taskCount: 3, hiddenAt: null });
    expect(res.lists.some((l) => l.id === 1 && !l.isDefault)).toBe(true);
    expect(res.currentService).toMatchObject({ listId: LIST, hasCheckoffs: false });
    expect(res.timeZone).toBe("America/Winnipeg");
  });
});

describe("creating", () => {
  it("creates an empty list, trimmed, and logs it", async () => {
    const res = await admin("POST", "/lists", { name: "  Christmas Eve  ", description: "  Candlelight service " });
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as CreatedResponse;
    expect((await lists()).lists.find((l) => l.id === id)).toMatchObject({
      name: "Christmas Eve",
      description: "Candlelight service",
      isDefault: false,
      departmentCount: 0,
    });
    expect((await listEdits()).map((e) => [e.action, e.itemName, e.after])).toEqual([["add", "Christmas Eve", null]]);
  });

  it("copies a live list's live structure in order, with new IDs, and leaves the original alone", async () => {
    await admin("DELETE", `/tasks/${T_BETA}`); // hidden items are not copied
    const id = await create({ name: "Copy", copyFrom: LIST });
    expect(await structure(id)).toEqual([
      ["Dept One", [["Sec A", ["Alpha"]], ["Sec B", ["Gamma"]]]],
      ["Dept Two", []],
    ]);
    const copied = (await (await admin("GET", `/lists/${id}`)).json()) as AdminListResponse;
    expect(copied.categories[0].id).not.toBe(D1);
    expect(copied.categories[0].linkCount).toBe(0); // Planning Center links stay with the original
    expect(await structure(LIST)).toEqual([
      ["Dept One", [["Sec A", ["Alpha"]], ["Sec B", ["Gamma"]]]],
      ["Dept Two", []],
    ]);
    // Editing the copy doesn't touch the original.
    await admin("PATCH", `/categories/${copied.categories[0].id}`, { name: "Dept One (copy)" });
    expect((await structure(LIST))[0][0]).toBe("Dept One");
    expect((await listEdits()).map((e) => [e.action, e.after])).toEqual([["add", { copiedFrom: { id: LIST, name: "Test list" } }]]);
  });

  it("copies a large list in a few statements (the seed checklist)", async () => {
    const id = await create({ name: "Seed copy", copyFrom: 1 });
    const summary = (await lists()).lists.find((l) => l.id === id);
    const seed = (await lists()).lists.find((l) => l.id === 1);
    expect(summary).toMatchObject({ departmentCount: seed?.departmentCount, taskCount: seed?.taskCount });
    expect(await structure(id)).toEqual(await structure(1));
  });

  it("refuses bad input and copying a hidden list", async () => {
    expect((await admin("POST", "/lists", { name: "  " })).status).toBe(400);
    expect((await admin("POST", "/lists", { name: "x".repeat(121) })).status).toBe(400);
    expect((await admin("POST", "/lists", { name: "X", description: "d".repeat(301) })).status).toBe(400);
    expect((await admin("POST", "/lists", { name: "X", copyFrom: "abc" })).status).toBe(400);
    const hidden = await create({ name: "Hidden" });
    await admin("DELETE", `/lists/${hidden}`);
    expect((await admin("POST", "/lists", { name: "X", copyFrom: hidden })).status).toBe(404);
  });
});

describe("renaming", () => {
  it("renames and describes a list, logging old and new", async () => {
    const id = await create({ name: "Draft" });
    expect((await admin("PATCH", `/lists/${id}`, { name: "Easter", description: "Sunrise service" })).status).toBe(204);
    expect((await lists()).lists.find((l) => l.id === id)).toMatchObject({ name: "Easter", description: "Sunrise service" });
    expect((await listEdits()).at(-1)).toMatchObject({
      action: "rename",
      before: { name: "Draft", description: null },
      after: { name: "Easter", description: "Sunrise service" },
    });
  });
});

describe("unique names (US-11)", () => {
  const error = async (res: Response) => ((await res.json()) as ApiErrorBody).error;

  it("refuses a name a visible list has, ignoring capitalization and extra spaces, and logs nothing", async () => {
    const res = await admin("POST", "/lists", { name: "  test   LIST " });
    expect(res.status).toBe(409);
    expect(await error(res)).toBe("There's already a list called “Test list”. Choose a different name.");
    // Copies too, and renames onto another list's name; renaming a list to itself (another spelling) is fine.
    expect((await admin("POST", "/lists", { name: "TEST LIST", copyFrom: LIST })).status).toBe(409);
    const other = await create({ name: "Other" });
    expect((await admin("PATCH", `/lists/${other}`, { name: "test list" })).status).toBe(409);
    expect((await admin("PATCH", `/lists/${LIST}`, { name: "TEST  List" })).status).toBe(204);
    expect((await lists()).lists.filter((l) => l.name.toLowerCase() === "test list").map((l) => l.name)).toEqual(["TEST List"]);
    expect((await listEdits()).map((e) => e.action)).toEqual(["add", "rename"]);
    // Nothing was half-created by the refused copy.
    expect((await lists()).lists).toHaveLength(3);
  });

  it("frees a hidden list's name, and won't restore it while a visible list has that name", async () => {
    const old = await create({ name: "Easter" });
    expect((await admin("DELETE", `/lists/${old}`)).status).toBe(204);
    const next = await create({ name: "easter" }); // the hidden one doesn't count
    const res = await admin("POST", `/lists/${old}/restore`);
    expect(res.status).toBe(409);
    expect(await error(res)).toBe("A visible list is already called “easter”. Rename that list first, then restore this one.");
    expect((await admin("PATCH", `/lists/${next}`, { name: "Easter 2027" })).status).toBe(204);
    expect((await admin("POST", `/lists/${old}/restore`)).status).toBe(204);
  });
});

describe("setting the default (US-11)", () => {
  it("switches the default for new services; the current service keeps its list", async () => {
    await checklist();
    const id = await create({ name: "New regular" });
    const res = await admin("POST", `/lists/${id}/default`, {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ serviceSwitched: false });
    const after = await lists();
    expect(after.lists.filter((l) => l.isDefault).map((l) => l.id)).toEqual([id]);
    expect(after.currentService?.listId).toBe(LIST);
    expect((await listEdits()).at(-1)).toMatchObject({
      action: "set_default",
      itemName: "New regular",
      before: { defaultList: { id: LIST, name: "Test list" } },
      after: { defaultList: { id, name: "New regular" }, serviceDate: null },
    });
    expect((await admin("POST", `/lists/${id}/default`, {})).status).toBe(409); // already the default
  });

  it("can switch the current service too, but only while it has no check-offs", async () => {
    const { service } = await checklist();
    const id = await create({ name: "Special", copyFrom: LIST });
    expect(await (await admin("POST", `/lists/${id}/default`, { applyToCurrentService: true })).json()).toEqual({ serviceSwitched: true });
    expect((await checklist()).list).toEqual({ id, name: "Special" });
    expect((await listEdits()).at(-1)?.after?.serviceDate).toBe(service.date);

    // With a check-off on it, the service keeps its list.
    const task = (await checklist()).categories[0].sections[0].tasks[0];
    await request(`/api/services/${service.id}/tasks/${task.id}/checkoff`, { method: "PUT", ...withCookie(cookies.volunteer) });
    expect(await (await admin("POST", `/lists/${LIST}/default`, { applyToCurrentService: true })).json()).toEqual({ serviceSwitched: false });
    expect((await checklist()).list.id).toBe(id);
  });
});

describe("hiding and restoring", () => {
  it("won't hide the default list or the list the current service uses", async () => {
    await checklist();
    const res = await admin("DELETE", `/lists/${LIST}`);
    expect(res.status).toBe(409);
    expect(((await res.json()) as ApiErrorBody).error).toContain("default list");
    const id = await create({ name: "Next" });
    await admin("POST", `/lists/${id}/default`, {}); // 77 is no longer default but the current service uses it
    expect(((await (await admin("DELETE", `/lists/${LIST}`)).json()) as ApiErrorBody).error).toContain("current service");
  });

  it("hides a list (kept, read-only) and restores it with its contents", async () => {
    const id = await create({ name: "Old", copyFrom: LIST });
    expect((await admin("DELETE", `/lists/${id}`)).status).toBe(204);
    expect((await lists()).lists.find((l) => l.id === id)?.hiddenAt).toEqual(expect.any(String));
    expect((await admin("GET", `/lists/${id}`)).status).toBe(404);
    const dept = (await env.DB.prepare("SELECT id FROM categories WHERE list_id = ? LIMIT 1").bind(id).first<{ id: number }>())?.id;
    expect((await admin("PATCH", `/categories/${dept}`, { name: "X" })).status).toBe(404); // inside a hidden list
    expect((await admin("DELETE", `/lists/${id}`)).status).toBe(404);

    expect((await admin("POST", `/lists/${id}/restore`)).status).toBe(204);
    expect(await structure(id)).toEqual(await structure(LIST));
    expect((await admin("POST", `/lists/${id}/restore`)).status).toBe(404);
    expect((await listEdits()).map((e) => e.action)).toEqual(["add", "hide", "restore"]);
  });
});

describe("the edit feed", () => {
  it("covers every list, naming the list of each entry, and can be filtered to one", async () => {
    const id = await create({ name: "Other" });
    await admin("PATCH", `/sections/${S_B}`, { name: "Sec Bee" });
    const all = ((await (await admin("GET", "/edits")).json()) as ChecklistEditsResponse).events.filter((e) => e.id > marker);
    expect(all.map((e) => [e.action, e.kind, e.list.name])).toEqual([
      ["rename", "section", "Test list"],
      ["add", "list", "Other"],
    ]);
    const one = ((await (await admin("GET", `/edits?list=${id}`)).json()) as ChecklistEditsResponse).events;
    expect(one.every((e) => e.list.id === id)).toBe(true);
    expect((await admin("GET", "/edits?list=abc")).status).toBe(404);
  });
});
