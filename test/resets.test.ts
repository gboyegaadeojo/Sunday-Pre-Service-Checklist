// Stage 4: progress data for everyone with access, reset/undo for Admins and Directors, activity log
// for Admins only (requirements v1.6: US-07, US-09, US-10, Q19).
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { ActivityResponse, ChecklistResponse, ResetResponse } from "../src/shared/types";
import { request, signInAs, withCookie } from "./helpers";

let volunteer: string;
let director: string;
let admin: string;
let serviceId: number;

beforeEach(async () => {
  await env.DB.batch([env.DB.prepare("DELETE FROM checkoffs"), env.DB.prepare("DELETE FROM resets"), env.DB.prepare("DELETE FROM services")]);
  [volunteer, director, admin] = await Promise.all([signInAs("volunteer"), signInAs("director"), signInAs("admin")]);
  serviceId = (await getChecklist(volunteer)).service.id;
});

async function getChecklist(cookie: string) {
  const res = await request("/api/checklist", withCookie(cookie));
  expect(res.status).toBe(200);
  return res.json<ChecklistResponse>();
}
const checkedIds = async (cookie = volunteer) =>
  (await getChecklist(cookie)).categories.flatMap((c) => c.sections.flatMap((s) => s.tasks)).filter((t) => t.checkoff).map((t) => t.id);
const check = (cookie: string, taskId: number) => request(`/api/services/${serviceId}/tasks/${taskId}/checkoff`, { method: "PUT", ...withCookie(cookie) });
const post = (cookie: string, path: "reset" | "undo-reset", id = serviceId) =>
  request(`/api/services/${id}/${path}`, { method: "POST", ...withCookie(cookie) });
const marker = async () => (await env.DB.prepare("SELECT COALESCE(MAX(id), 0) AS m FROM checkoff_events").first<{ m: number }>())?.m ?? 0;
const eventsSince = async (m: number) =>
  (await env.DB.prepare("SELECT action, outcome, affected, task_id, user_name FROM checkoff_events WHERE id > ? ORDER BY id").bind(m).all()).results;

describe("progress data (US-09)", () => {
  it("is available to everyone with access, with who checked each task and when", async () => {
    await check(volunteer, 1);
    for (const cookie of [volunteer, director, admin]) {
      const task = (await getChecklist(cookie)).categories[0].sections[0].tasks[0];
      expect(task.checkoff?.by).toBe("Test Volunteer");
    }
    expect((await request("/api/checklist", withCookie(await signInAs("outsider")))).status).toBe(403);
  });

  it("includes reset details only for Admins and Directors (US-17)", async () => {
    expect("reset" in (await getChecklist(volunteer)).service).toBe(false);
    expect((await getChecklist(director)).service.reset).toBeNull();
    await check(volunteer, 1);
    await post(director, "reset");
    expect((await getChecklist(admin)).service.reset).toMatchObject({ by: "Test Director", archived: 1, canUndo: true });
    expect("reset" in (await getChecklist(volunteer)).service).toBe(false);
  });
});

describe("reset (US-07)", () => {
  it("is refused for Volunteers, and for non-members", async () => {
    await check(volunteer, 1);
    const res = await post(volunteer, "reset");
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "forbidden" });
    expect((await post(await signInAs("outsider"), "reset")).status).toBe(403);
    expect((await post(volunteer, "undo-reset")).status).toBe(403);
    expect(await checkedIds()).toEqual([1]);
  });

  it.each([
    ["Director", () => director],
    ["Admin", () => admin],
  ])("lets a %s archive every check-off, keeping them in the database", async (_, who) => {
    await check(volunteer, 1);
    await check(volunteer, 2);
    const m = await marker();
    const res = await post(who(), "reset");
    expect(res.status).toBe(200);
    const body = await res.json<ResetResponse>();
    expect(body.affected).toBe(2);
    expect(body.reset).toMatchObject({ archived: 2, canUndo: true, undoneAt: null });

    expect(await checkedIds()).toEqual([]);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM checkoffs WHERE reset_id IS NOT NULL").first<{ n: number }>())?.n).toBe(2);
    expect(await eventsSince(m)).toEqual([{ action: "reset", outcome: "applied", affected: 2, task_id: null, user_name: body.reset.by }]);
  });

  it("refuses to reset when nothing is checked, so an earlier reset stays undoable", async () => {
    await check(volunteer, 1);
    await post(director, "reset");
    const m = await marker();
    const res = await post(director, "reset");
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "nothing_to_reset" });
    expect(await eventsSince(m)).toEqual([{ action: "reset", outcome: "no_change", affected: null, task_id: null, user_name: "Test Director" }]);
    expect((await post(director, "undo-reset")).status).toBe(200);
    expect(await checkedIds()).toEqual([1]);
  });

  it("only acts on the current service", async () => {
    await check(volunteer, 1);
    const res = await post(director, "reset", serviceId + 100);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "service_changed" });
    expect(await checkedIds()).toEqual([1]);
  });
});

describe("undo reset (US-07, D3)", () => {
  it("restores the archived check-offs with their original names and times", async () => {
    await check(volunteer, 1);
    const before = (await getChecklist(volunteer)).categories[0].sections[0].tasks[0].checkoff;
    await post(director, "reset");
    const m = await marker();
    const res = await post(admin, "undo-reset");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ affected: 1, reset: { canUndo: false, undoneBy: "Test Admin" } });
    expect((await getChecklist(volunteer)).categories[0].sections[0].tasks[0].checkoff).toEqual(before);
    expect(await eventsSince(m)).toEqual([{ action: "undo_reset", outcome: "applied", affected: 1, task_id: null, user_name: "Test Admin" }]);
  });

  it("keeps a newer check-off when a task was checked again after the reset", async () => {
    await check(volunteer, 1);
    await check(volunteer, 2);
    await post(director, "reset");
    await check(admin, 1); // checked again after the reset
    const res = await post(director, "undo-reset");
    expect(await res.json()).toMatchObject({ affected: 1 });

    const tasks = (await getChecklist(volunteer)).categories[0].sections[0].tasks;
    expect(tasks[0].checkoff?.by).toBe("Test Admin"); // newer wins
    expect(tasks[1].checkoff?.by).toBe("Test Volunteer"); // restored
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM checkoffs WHERE task_id = 1 AND reset_id IS NOT NULL").first<{ n: number }>())?.n).toBe(1);
  });

  it("works only once, and only for the latest reset", async () => {
    await check(volunteer, 1);
    await post(director, "reset");
    await check(volunteer, 2);
    await post(director, "reset"); // second reset archives task 2
    expect(await (await post(director, "undo-reset")).json()).toMatchObject({ affected: 1 });
    expect(await checkedIds()).toEqual([2]); // the first reset's task 1 is not brought back

    const again = await post(director, "undo-reset");
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ code: "nothing_to_undo" });
  });

  it("has nothing to undo before any reset", async () => {
    expect((await post(director, "undo-reset")).status).toBe(409);
  });
});

describe("activity log view (Admin only)", () => {
  it("lists the service's events newest first, with task text", async () => {
    await check(volunteer, 1);
    await post(director, "reset");
    const res = await request(`/api/services/${serviceId}/events`, withCookie(admin));
    expect(res.status).toBe(200);
    const body = await res.json<ActivityResponse>();
    expect(body.service).toMatchObject({ id: serviceId, timeZone: "America/Winnipeg" });
    expect(body.events.map((e) => [e.action, e.outcome, e.user])).toEqual([
      ["reset", "applied", "Test Director"],
      ["check", "applied", "Test Volunteer"],
    ]);
    expect(body.events[1].taskText).toMatch(/^Verify all server rack devices/);
    expect(body.truncated).toBe(false);
  });

  it("is refused for Directors and Volunteers", async () => {
    expect((await request(`/api/services/${serviceId}/events`, withCookie(director))).status).toBe(403);
    expect((await request(`/api/services/${serviceId}/events`, withCookie(volunteer))).status).toBe(403);
    expect((await request(`/api/services/${serviceId}/events`)).status).toBe(401);
  });

  it('accepts "current" for the current service', async () => {
    await check(volunteer, 1);
    const body = await (await request("/api/services/current/events", withCookie(admin))).json<ActivityResponse>();
    expect(body.service.id).toBe(serviceId);
    expect(body.events).toHaveLength(1);
  });

  it("returns 404 for an unknown service", async () => {
    expect((await request(`/api/services/${serviceId + 999}/events`, withCookie(admin))).status).toBe(404);
  });
});
