// Stage 5d.3: service history (design.md §7, US-07). Admin only and read-only. Past services show what was
// checked from the check-off snapshots, so editing, moving or hiding items afterwards never changes them
// (US-06, US-12, US-13); the activity log of a past service shows task text as it was then.
import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { ActivityResponse, HistoryResponse, ServiceHistoryResponse } from "../src/shared/types";
import { D1, LIST, S_A, S_B, T_ALPHA, T_BETA, T_GAMMA, api, checklist, cookies, setUpAdminFixture } from "./admin-fixture";
import { request, withCookie } from "./helpers";

setUpAdminFixture();

const PAST = "2026-01-04";

const check = (serviceId: number, taskId: number, cookie = cookies.volunteer) =>
  request(`/api/services/${serviceId}/tasks/${taskId}/checkoff`, { method: "PUT", ...withCookie(cookie) });

/** Checks the given tasks on the current service, then moves that service into the past. Returns its ID. */
async function pastServiceWith(taskIds: number[]): Promise<number> {
  const { id } = (await checklist()).service;
  for (const t of taskIds) expect((await check(id, t)).status).toBe(200);
  await env.DB.prepare("UPDATE services SET service_date = ? WHERE id = ?").bind(PAST, id).run();
  return id;
}

const history = async () => (await (await api(cookies.admin, "GET", "/history")).json()) as HistoryResponse;
const record = async (id: number) => (await (await api(cookies.admin, "GET", `/history/${id}`)).json()) as ServiceHistoryResponse;
/** "Department › Section › task" for each checked task, in display order. */
const placed = (r: ServiceHistoryResponse) => r.categories.flatMap((c) => c.sections.flatMap((s) => s.tasks.map((t) => `${c.name} › ${s.name} › ${t.text}`)));

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
  it("lists past services newest first, without the current one", async () => {
    const older = await pastServiceWith([T_ALPHA, T_BETA]);
    await env.DB.prepare("UPDATE services SET service_date = '2025-12-28' WHERE id = ?").bind(older).run();
    const newer = await pastServiceWith([T_GAMMA]);
    const current = (await checklist()).service.id;

    const { services, truncated } = await history();
    expect(services.map((s) => s.id)).toEqual([newer, older]);
    expect(services.map((s) => s.id)).not.toContain(current);
    expect(services[1]).toEqual({
      id: older,
      date: "2025-12-28",
      list: { id: LIST, name: "Test list", hidden: false },
      checkedCount: 2,
      resetCount: 0,
    });
    expect(truncated).toBe(false);
  });

  it("is empty when there are no past services", async () => {
    await checklist(); // creates only the current service
    expect((await history()).services).toEqual([]);
  });
});

describe("one service", () => {
  it("groups what was checked by department and section, with who and when", async () => {
    const id = await pastServiceWith([T_GAMMA, T_ALPHA]);
    const r = await record(id);
    expect(r.service).toMatchObject({ id, date: PAST, checkedCount: 2, resetCount: 0, isCurrent: false, timeZone: "America/Winnipeg" });
    expect(placed(r)).toEqual(["Dept One › Sec A › Alpha", "Dept One › Sec B › Gamma"]);
    expect(r.categories[0].sections[0].tasks[0]).toMatchObject({ taskId: T_ALPHA, by: "Test Volunteer" });
    expect(r.resets).toEqual([]);
  });

  it("keeps the old text after a task is edited (US-06)", async () => {
    const id = await pastServiceWith([T_ALPHA]);
    expect((await api(cookies.admin, "PATCH", `/tasks/${T_ALPHA}`, { text: "Alpha, reworded" })).status).toBe(204);
    expect(placed(await record(id))).toEqual(["Dept One › Sec A › Alpha"]);

    // The past service's log shows the old text too; the current service shows today's.
    const log = (await (await request(`/api/services/${id}/events`, withCookie(cookies.admin))).json()) as ActivityResponse;
    expect(log.events.map((e) => e.taskText)).toEqual(["Alpha"]);
    const current = (await checklist()).service.id;
    await check(current, T_ALPHA);
    const now = (await (await request("/api/services/current/events", withCookie(cookies.admin))).json()) as ActivityResponse;
    expect(now.service.id).toBe(current);
    expect(now.events[0].taskText).toBe("Alpha, reworded");
  });

  it("keeps showing a department after it's hidden (US-12)", async () => {
    const id = await pastServiceWith([T_ALPHA, T_GAMMA]);
    expect((await api(cookies.admin, "DELETE", `/categories/${D1}`)).status).toBe(204);
    expect((await checklist()).categories.map((c) => c.name)).not.toContain("Dept One");
    expect(placed(await record(id))).toEqual(["Dept One › Sec A › Alpha", "Dept One › Sec B › Gamma"]);
  });

  it("shows tasks where they were, after moves and renames (US-13)", async () => {
    const id = await pastServiceWith([T_BETA]);
    expect((await api(cookies.admin, "POST", `/tasks/${T_BETA}/move`, { sectionId: S_B })).status).toBe(204);
    expect((await api(cookies.admin, "PATCH", `/sections/${S_A}`, { name: "Renamed A" })).status).toBe(204);
    expect(placed(await record(id))).toEqual(["Dept One › Sec A › Beta"]);
  });

  it("leaves out unchecked and reset tasks, and lists every reset", async () => {
    const { id } = (await checklist()).service;
    await check(id, T_ALPHA);
    expect((await request(`/api/services/${id}/reset`, { method: "POST", ...withCookie(cookies.director) })).status).toBe(200);
    await check(id, T_BETA);
    await check(id, T_GAMMA);
    await request(`/api/services/${id}/tasks/${T_GAMMA}/checkoff`, { method: "DELETE", ...withCookie(cookies.volunteer) });
    await env.DB.prepare("UPDATE services SET service_date = ? WHERE id = ?").bind(PAST, id).run();

    const r = await record(id);
    expect(placed(r)).toEqual(["Dept One › Sec A › Beta"]);
    expect(r.service).toMatchObject({ checkedCount: 1, resetCount: 1 });
    expect(r.resets).toEqual([expect.objectContaining({ by: "Test Director", archived: 1, undoneAt: null, undoneBy: null })]);
  });

  it("marks the current service, and 404s for an unknown one", async () => {
    const { id } = (await checklist()).service;
    expect((await record(id)).service.isCurrent).toBe(true);
    expect((await api(cookies.admin, "GET", "/history/999999")).status).toBe(404);
    expect((await api(cookies.admin, "GET", "/history/abc")).status).toBe(404);
  });
});
