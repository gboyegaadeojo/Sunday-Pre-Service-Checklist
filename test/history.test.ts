// Service history (Stage 5d.3, design.md §7, US-07) and the record of each service's checklist (US-07b,
// requirements v1.16). Admin only and read-only.
// - The record holds every task on the checklist while the service was current: seeded when the service first
//   loads, then kept in step with every edit in the same transaction, and frozen once the service is over. History
//   shows "X of Y done", the unchecked tasks, and the tasks removed during the service.
// - Services without a record (from before it existed) show what was checked, from the check-off snapshots, so
//   later edits, moves and hides never change them (US-06, US-12, US-13).
import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { ActivityResponse, HistoryResponse, ServiceHistoryResponse } from "../src/shared/types";
import { D1, D2, LIST, S_A, S_B, T_ALPHA, T_BETA, T_GAMMA, api, checklist, cookies, setUpAdminFixture } from "./admin-fixture";
import { request, withCookie } from "./helpers";

setUpAdminFixture();

const PAST = "2026-01-04";

const check = (serviceId: number, taskId: number, cookie = cookies.volunteer) =>
  request(`/api/services/${serviceId}/tasks/${taskId}/checkoff`, { method: "PUT", ...withCookie(cookie) });
const endService = (id: number, date = PAST) => env.DB.prepare("UPDATE services SET service_date = ? WHERE id = ?").bind(date, id).run();

/** The current service with the given tasks checked. */
async function currentWith(taskIds: number[]): Promise<number> {
  const { id } = (await checklist()).service;
  for (const t of taskIds) expect((await check(id, t)).status).toBe(200);
  return id;
}

/** Checks the given tasks on the current service, then moves that service into the past. */
async function pastServiceWith(taskIds: number[]): Promise<number> {
  const id = await currentWith(taskIds);
  await endService(id);
  return id;
}

/** Makes a service look like one from before the record existed. */
const dropRecord = (id: number) =>
  env.DB.batch([
    env.DB.prepare("DELETE FROM service_tasks WHERE service_id = ?").bind(id),
    env.DB.prepare("UPDATE services SET tasks_recorded_from = NULL WHERE id = ?").bind(id),
  ]);

const history = async () => (await (await api(cookies.admin, "GET", "/history")).json()) as HistoryResponse;
const record = async (id: number) => (await (await api(cookies.admin, "GET", `/history/${id}`)).json()) as ServiceHistoryResponse;
/** "Department › Section › task" with ✓ for checked ones, in display order. */
const placed = (r: ServiceHistoryResponse) =>
  r.categories.flatMap((c) => c.sections.flatMap((s) => s.tasks.map((t) => `${c.name} › ${s.name} › ${t.text}${t.checkoff ? " ✓" : ""}`)));
const removed = (r: ServiceHistoryResponse) => r.removed.map((t) => `${t.department} › ${t.section} › ${t.text}${t.checkoff ? " ✓" : ""}`);
const edit = async (method: string, path: string, body?: unknown) => expect((await api(cookies.admin, method, path, body)).status).toBe(204);

describe("access", () => {
  it("is Admin only", async () => {
    const id = await pastServiceWith([]);
    for (const path of ["/history", `/history/${id}`]) {
      expect((await api(cookies.director, "GET", path)).status, `${path} as Director`).toBe(403);
      expect((await api(cookies.volunteer, "GET", path)).status, `${path} as Volunteer`).toBe(403);
      expect((await request(`/api/admin${path}`)).status, `${path} signed out`).toBe(401);
    }
  });

  it("has no way to change history", async () => {
    const id = await pastServiceWith([T_ALPHA]);
    for (const method of ["PUT", "PATCH", "DELETE", "POST"]) {
      expect((await api(cookies.admin, method, `/history/${id}`, {})).status, method).toBe(404);
    }
    // Check-offs are only accepted for the current service.
    expect((await check(id, T_BETA)).status).toBe(409);
  });
});

describe("the list of services", () => {
  it("lists past services newest first, without the current one, with X of Y", async () => {
    const older = await pastServiceWith([T_ALPHA, T_BETA]);
    await endService(older, "2025-12-28");
    const newer = await pastServiceWith([T_GAMMA]);
    await dropRecord(newer);
    const current = (await checklist()).service.id;

    const { services, truncated } = await history();
    expect(services.map((s) => s.id)).toEqual([newer, older]);
    expect(services.map((s) => s.id)).not.toContain(current);
    expect(services[1]).toEqual({
      id: older,
      date: "2025-12-28",
      list: { id: LIST, name: "Test list", hidden: false },
      checkedCount: 2,
      totalCount: 3,
      resetCount: 0,
    });
    expect(services[0]).toMatchObject({ checkedCount: 1, totalCount: null }); // no record: no total
    expect(truncated).toBe(false);
  });

  it("is empty when there are no past services", async () => {
    await checklist(); // creates only the current service
    expect((await history()).services).toEqual([]);
  });
});

describe("the record of a service's checklist (US-07b)", () => {
  it("starts with every task on the list when the service first loads", async () => {
    const id = await pastServiceWith([T_GAMMA]);
    const r = await record(id);
    expect(r.service).toMatchObject({ checkedCount: 1, totalCount: 3, record: { partial: false } });
    expect(placed(r)).toEqual(["Dept One › Sec A › Alpha", "Dept One › Sec A › Beta", "Dept One › Sec B › Gamma ✓"]);
    expect(r.categories[0].sections[1].tasks[0].checkoff).toMatchObject({ by: "Test Volunteer", text: "Gamma" });
    expect(r.removed).toEqual([]);
  });

  it("follows adds, moves, edits and reorders during the service, ending where volunteers last saw them", async () => {
    const id = await currentWith([T_ALPHA]);
    const added = (await (await api(cookies.admin, "POST", `/sections/${S_B}/tasks`, { text: "Delta" })).json()) as { id: number };
    expect(added.id).toBeGreaterThan(0);
    await edit("PATCH", `/tasks/${T_ALPHA}`, { text: "Alpha, reworded" });
    await edit("POST", `/tasks/${T_ALPHA}/move`, { sectionId: S_B });
    await edit("POST", `/sections/${S_B}/reorder`, { direction: "up" });
    await edit("PATCH", `/categories/${D1}`, { name: "Dept 1" });
    await endService(id);

    const r = await record(id);
    expect(placed(r)).toEqual([
      "Dept 1 › Sec B › Gamma",
      "Dept 1 › Sec B › Delta",
      "Dept 1 › Sec B › Alpha, reworded ✓",
      "Dept 1 › Sec A › Beta",
    ]);
    // Checked under its old text: history says so.
    expect(r.categories[0].sections[0].tasks[2].checkoff?.text).toBe("Alpha");
    expect(r.service).toMatchObject({ checkedCount: 1, totalCount: 4 });
  });

  it("lists tasks removed during the service apart, uncounted, and takes back restored ones", async () => {
    const id = await currentWith([T_BETA]);
    await edit("DELETE", `/tasks/${T_BETA}`); // checked, then hidden
    await edit("DELETE", `/sections/${S_B}`); // Gamma goes with its section
    await edit("DELETE", `/tasks/${T_ALPHA}`);
    await edit("POST", `/tasks/${T_ALPHA}/restore`, {});
    await endService(id);

    const r = await record(id);
    expect(placed(r)).toEqual(["Dept One › Sec A › Alpha"]);
    expect(removed(r)).toEqual(["Dept One › Sec A › Beta ✓", "Dept One › Sec B › Gamma"]);
    expect(r.removed.every((t) => t.removedAt !== null)).toBe(true);
    expect(r.service).toMatchObject({ checkedCount: 0, totalCount: 1 });
  });

  it("stops changing once the service is over", async () => {
    const id = await pastServiceWith([T_ALPHA]);
    const before = await record(id);
    await edit("PATCH", `/tasks/${T_BETA}`, { text: "Beta, later" });
    await edit("DELETE", `/categories/${D1}`);
    await api(cookies.admin, "POST", `/lists/${LIST}/categories`, { name: "New dept" });
    expect(await record(id)).toEqual(before);

    // The database refuses it too (migration 0007 trigger).
    await expect(env.DB.prepare("UPDATE service_tasks SET text = 'x' WHERE service_id = ?").bind(id).run()).rejects.toThrow(/has ended/);
  });

  it("starts over when the current service switches to another list before anything is checked (US-11)", async () => {
    const id = (await checklist()).service.id;
    expect((await api(cookies.admin, "POST", "/lists/1/default", { applyToCurrentService: true })).status).toBe(200);
    const r = await record(id);
    expect(r.service.list.id).toBe(1);
    // Only the new list's tasks: none of the test list's departments are left.
    expect(r.categories.map((c) => c.id)).not.toContain(D1);
    const seedTasks = (await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM tasks t JOIN sections s ON s.id = t.section_id JOIN categories c ON c.id = s.category_id
        WHERE c.list_id = 1 AND t.deleted_at IS NULL AND s.deleted_at IS NULL AND c.deleted_at IS NULL`,
    ).first<{ n: number }>())?.n;
    expect(r.service.totalCount).toBe(seedTasks);
  });

  it("marks a record that started partway through, keeping earlier check-offs of hidden tasks", async () => {
    // The service that was current when this feature shipped: created earlier, no record yet.
    const id = await currentWith([T_BETA]);
    await dropRecord(id);
    await env.DB.prepare("UPDATE services SET created_at = '2026-01-01T00:00:00.000Z' WHERE id = ?").bind(id).run();
    await env.DB.prepare(`UPDATE tasks SET deleted_at = '2026-01-01T00:00:00.000Z' WHERE id = ${T_BETA}`).run();
    expect((await checklist()).service.id).toBe(id); // the first load after shipping starts the record
    await endService(id);

    const r = await record(id);
    expect(r.service.record).toMatchObject({ partial: true });
    expect(placed(r)).toEqual(["Dept One › Sec A › Alpha", "Dept One › Sec B › Gamma"]);
    expect(r.removed).toEqual([expect.objectContaining({ text: "Beta", removedAt: null, checkoff: expect.objectContaining({ by: "Test Volunteer" }) })]);
  });

  it("leaves out unchecked and reset check-offs from X, and lists every reset", async () => {
    const id = await currentWith([T_ALPHA]);
    expect((await request(`/api/services/${id}/reset`, { method: "POST", ...withCookie(cookies.director) })).status).toBe(200);
    await check(id, T_BETA);
    await check(id, T_GAMMA);
    await request(`/api/services/${id}/tasks/${T_GAMMA}/checkoff`, { method: "DELETE", ...withCookie(cookies.volunteer) });
    await endService(id);

    const r = await record(id);
    expect(placed(r)).toEqual(["Dept One › Sec A › Alpha", "Dept One › Sec A › Beta ✓", "Dept One › Sec B › Gamma"]);
    expect(r.service).toMatchObject({ checkedCount: 1, totalCount: 3, resetCount: 1 });
    expect(r.resets).toEqual([expect.objectContaining({ by: "Test Director", archived: 1, undoneAt: null, undoneBy: null })]);
  });
});

describe("services without a record (before US-07b)", () => {
  it("show only what was checked, from the snapshots, with no total", async () => {
    const id = await pastServiceWith([T_GAMMA, T_ALPHA]);
    await dropRecord(id);
    const r = await record(id);
    expect(r.service).toMatchObject({ id, date: PAST, checkedCount: 2, totalCount: null, record: null, isCurrent: false });
    expect(placed(r)).toEqual(["Dept One › Sec A › Alpha ✓", "Dept One › Sec B › Gamma ✓"]);
  });

  it("keep the old text, department and place after edits, hides and moves", async () => {
    const id = await pastServiceWith([T_ALPHA, T_BETA, T_GAMMA]);
    await dropRecord(id);
    await edit("PATCH", `/tasks/${T_ALPHA}`, { text: "Alpha, reworded" });
    await edit("POST", `/tasks/${T_BETA}/move`, { sectionId: S_B });
    await edit("PATCH", `/sections/${S_A}`, { name: "Renamed A" });
    await edit("DELETE", `/categories/${D1}`);
    expect((await checklist()).categories.map((c) => c.id)).toEqual([D2]);
    expect(placed(await record(id))).toEqual(["Dept One › Sec A › Alpha ✓", "Dept One › Sec A › Beta ✓", "Dept One › Sec B › Gamma ✓"]);
  });
});

describe("a past service's activity log", () => {
  it("shows task text as it was then; the current service shows today's", async () => {
    const id = await pastServiceWith([T_ALPHA]);
    await edit("PATCH", `/tasks/${T_ALPHA}`, { text: "Alpha, reworded" });
    const log = (await (await request(`/api/services/${id}/events`, withCookie(cookies.admin))).json()) as ActivityResponse;
    expect(log.events.map((e) => e.taskText)).toEqual(["Alpha"]);
    const current = await currentWith([T_ALPHA]);
    const now = (await (await request("/api/services/current/events", withCookie(cookies.admin))).json()) as ActivityResponse;
    expect(now.service.id).toBe(current);
    expect(now.events[0].taskText).toBe("Alpha, reworded");
  });
});

describe("one service", () => {
  it("marks the current service, and 404s for an unknown one", async () => {
    const { id } = (await checklist()).service;
    expect((await record(id)).service.isCurrent).toBe(true);
    expect((await api(cookies.admin, "GET", "/history/999999")).status).toBe(404);
    expect((await api(cookies.admin, "GET", "/history/abc")).status).toBe(404);
  });
});
