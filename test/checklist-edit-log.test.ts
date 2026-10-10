// Stage 5c: every applied checklist edit is logged, append-only, with who, when and before/after (US-13b).
// The log is never cleared: each test reads only rows after a marker ID.
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { ChecklistEditEvent, ChecklistEditsResponse, CreatedResponse } from "../src/shared/types";
import { D1, D2, LIST, S_A, S_B, T_ALPHA, T_BETA, api, cookies, setUpAdminFixture } from "./admin-fixture";
import { request, userIdOf } from "./helpers";

setUpAdminFixture();

let marker: number;
beforeEach(async () => {
  marker = (await env.DB.prepare("SELECT COALESCE(MAX(id), 0) AS id FROM checklist_events").first<{ id: number }>())?.id ?? 0;
});

const TAB = "tab-for-edit-log";
const admin = (method: string, path: string, body?: unknown) =>
  request(`/api/admin${path}`, {
    method,
    headers: { Cookie: cookies.admin, "Content-Type": "application/json", "X-Tab-Id": TAB, "User-Agent": "edit-log-test" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
/** This test's entries, oldest first, as the API returns them. */
const edits = async (): Promise<ChecklistEditEvent[]> => {
  const res = (await (await admin("GET", "/lists/default/edits")).json()) as ChecklistEditsResponse;
  return res.events.filter((e) => e.id > marker).reverse();
};
const summary = (e: ChecklistEditEvent) => [e.action, e.kind, e.itemName, e.before, e.after];

describe("access", () => {
  it("is Admin only", async () => {
    expect((await api(cookies.director, "GET", "/lists/default/edits")).status).toBe(403);
    expect((await api(cookies.volunteer, "GET", "/lists/default/edits")).status).toBe(403);
    expect((await request("/api/admin/lists/default/edits")).status).toBe(401);
  });
});

describe("what is logged", () => {
  it("records who made each change, from which session and tab", async () => {
    await admin("PATCH", `/tasks/${T_ALPHA}`, { text: "Alpha 2" });
    const row = await env.DB.prepare("SELECT * FROM checklist_events WHERE id > ?").bind(marker).first<Record<string, unknown>>();
    expect(row).toMatchObject({
      list_id: LIST,
      entity: "task",
      entity_id: T_ALPHA,
      action: "edit",
      user_id: await userIdOf("admin"),
      user_name: "Test Admin",
      tab_id: TAB,
      user_agent: "edit-log-test",
    });
    expect(row?.session_id).toEqual(expect.any(String));
    const [event] = await edits();
    expect(event).toMatchObject({ user: "Test Admin", tabId: TAB, sessionId: row?.session_id });
  });

  it("logs adds with where they went", async () => {
    const { id } = (await (await admin("POST", `/sections/${S_A}/tasks`, { text: "Delta" })).json()) as CreatedResponse;
    await admin("POST", `/lists/${LIST}/categories`, { name: "Lighting" });
    expect((await edits()).map(summary)).toEqual([
      [
        "add",
        "task",
        "Delta",
        null,
        { place: { department: { id: D1, name: "Dept One" }, section: { id: S_A, name: "Sec A" }, position: 3 } },
      ],
      ["add", "category", "Lighting", null, { place: { position: 3 } }],
    ]);
    expect((await edits())[0].itemId).toBe(id);
  });

  it("logs renames and edits with old and new values", async () => {
    await admin("PATCH", `/categories/${D1}`, { name: "Dept Uno" });
    await admin("PATCH", `/sections/${S_A}`, { name: "Sec Alpha" });
    await admin("PATCH", `/tasks/${T_ALPHA}`, { text: "Alpha (revised)" });
    expect((await edits()).map(summary)).toEqual([
      ["rename", "category", "Dept Uno", { name: "Dept One" }, { name: "Dept Uno" }],
      ["rename", "section", "Sec Alpha", { name: "Sec A" }, { name: "Sec Alpha" }],
      ["edit", "task", "Alpha (revised)", { text: "Alpha" }, { text: "Alpha (revised)" }],
    ]);
  });

  it("logs moves and reorders with the place before and after", async () => {
    const { id: secC } = (await (await admin("POST", `/categories/${D2}/sections`, { name: "Sec C" })).json()) as CreatedResponse;
    marker = (await env.DB.prepare("SELECT MAX(id) AS id FROM checklist_events").first<{ id: number }>())?.id ?? 0;
    await admin("POST", `/tasks/${T_ALPHA}/move`, { sectionId: secC });
    await admin("POST", `/sections/${S_B}/move`, { categoryId: D2 });
    await admin("POST", `/categories/${D2}/reorder`, { direction: "up" });

    const dept = (id: number, name: string) => ({ id, name });
    expect((await edits()).map(summary)).toEqual([
      [
        "move",
        "task",
        "Alpha",
        { place: { department: dept(D1, "Dept One"), section: { id: S_A, name: "Sec A" }, position: 1 } },
        { place: { department: dept(D2, "Dept Two"), section: { id: secC, name: "Sec C" }, position: 1 } },
      ],
      ["move", "section", "Sec B", { place: { department: dept(D1, "Dept One"), position: 2 } }, { place: { department: dept(D2, "Dept Two"), position: 2 } }],
      ["reorder", "category", "Dept Two", { place: { position: 2 } }, { place: { position: 1 } }],
    ]);
  });

  it("logs hiding, including the Planning Center links a hidden department loses", async () => {
    await admin("DELETE", `/tasks/${T_BETA}`);
    await admin("DELETE", `/sections/${S_B}`);
    await admin("DELETE", `/categories/${D1}`);
    await admin("DELETE", `/categories/${D2}`);
    expect((await edits()).map(summary)).toEqual([
      ["hide", "task", "Beta", null, null],
      ["hide", "section", "Sec B", null, null],
      ["hide", "category", "Dept One", { teamLinks: ["Team 1", "Team 2"] }, null],
      ["hide", "category", "Dept Two", null, null], // had no links
    ]);
  });

  it("logs each item a restore brings back, parents first", async () => {
    await admin("DELETE", `/tasks/${T_BETA}`);
    await admin("DELETE", `/sections/${S_A}`);
    await admin("DELETE", `/categories/${D1}`);
    marker = (await env.DB.prepare("SELECT MAX(id) AS id FROM checklist_events").first<{ id: number }>())?.id ?? 0;
    await admin("POST", `/tasks/${T_BETA}/restore`, { withParents: true });
    expect((await edits()).map((e) => [e.action, e.kind, e.itemName, e.after?.place?.position])).toEqual([
      ["restore", "category", "Dept One", 1],
      ["restore", "section", "Sec A", 1],
      ["restore", "task", "Beta", 2],
    ]);
  });

  it("logs nothing when an edit is refused", async () => {
    await env.DB.prepare(`UPDATE sections SET deleted_at = '2026-10-01T00:00:00Z' WHERE id = ${S_B}`).run();
    expect((await admin("POST", `/sections/${S_B}/tasks`, { text: "X" })).status).toBe(404);
    expect((await admin("POST", `/tasks/${T_ALPHA}/move`, { sectionId: S_B })).status).toBe(404);
    expect((await admin("POST", `/tasks/${T_ALPHA}/reorder`, { direction: "up" })).status).toBe(409);
    expect((await admin("POST", `/tasks/${T_BETA}/restore`)).status).toBe(404);
    expect((await admin("PATCH", "/tasks/999999", { text: "X" })).status).toBe(404);
    expect(await edits()).toEqual([]);
  });

  it("returns newest first", async () => {
    await admin("PATCH", `/tasks/${T_ALPHA}`, { text: "One" });
    await admin("PATCH", `/tasks/${T_ALPHA}`, { text: "Two" });
    const res = (await (await admin("GET", "/lists/default/edits")).json()) as ChecklistEditsResponse;
    expect(res.events.slice(0, 2).map((e) => e.itemName)).toEqual(["Two", "One"]);
    expect(res.timeZone).toBe("America/Winnipeg");
  });
});

describe("append-only", () => {
  it("rejects UPDATE and DELETE on the log, even directly in the database", async () => {
    await admin("PATCH", `/tasks/${T_ALPHA}`, { text: "Logged" });
    await expect(env.DB.prepare("UPDATE checklist_events SET user_name = 'x' WHERE id > ?").bind(marker).run()).rejects.toThrow(/append-only/);
    await expect(env.DB.prepare("DELETE FROM checklist_events WHERE id > ?").bind(marker).run()).rejects.toThrow(/append-only/);
    expect(await edits()).toHaveLength(1);
  });
});
