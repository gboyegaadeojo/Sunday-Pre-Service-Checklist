// The append-only checkoff_events log: every check/uncheck attempt with who, when, which task and which
// browser session, never edited or deleted. Also the reload-while-saving race on the server.
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { ChecklistResponse } from "../src/shared/types";
import { createSessionToken } from "../src/worker/lib/session";
import { request, signInAs } from "./helpers";

let volunteer: string;

beforeEach(async () => {
  // checkoff_events is never cleared (it cannot be); tests read only rows added after a marker.
  await env.DB.batch([env.DB.prepare("DELETE FROM checkoffs"), env.DB.prepare("DELETE FROM services")]);
  volunteer = await signInAs("volunteer");
});

const headers = (cookie: string, tabId?: string) => ({ Cookie: cookie, ...(tabId ? { "X-Tab-Id": tabId } : {}) });
const getChecklist = async (cookie = volunteer) => (await request("/api/checklist", { headers: headers(cookie) })).json<ChecklistResponse>();
const url = (serviceId: number, taskId: number) => `/api/services/${serviceId}/tasks/${taskId}/checkoff`;

const marker = async () => (await env.DB.prepare("SELECT COALESCE(MAX(id), 0) AS m FROM checkoff_events").first<{ m: number }>())?.m ?? 0;
const eventsSince = async (m: number) =>
  (
    await env.DB.prepare(
      `SELECT service_id, task_id, action, outcome, user_pco_id, user_name, session_id, tab_id, created_at
         FROM checkoff_events WHERE id > ? ORDER BY id`,
    )
      .bind(m)
      .all<Record<string, string | number | null>>()
  ).results;

/** The session ID inside a "session=…" cookie. */
const sessionIdOf = (cookie: string) => {
  const body = cookie.replace(/^session=/, "").split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
  return (JSON.parse(atob(body)) as { sid: string }).sid;
};

describe("checkoff_events log", () => {
  it("records every check and uncheck with outcome, user, session and tab", async () => {
    const { service } = await getChecklist();
    const m = await marker();
    const h = headers(volunteer, "tab-a1");
    await request(url(service.id, 1), { method: "PUT", headers: h });
    await request(url(service.id, 1), { method: "PUT", headers: h });
    await request(url(service.id, 1), { method: "DELETE", headers: h });
    await request(url(service.id, 1), { method: "DELETE", headers: h });
    await env.DB.prepare("UPDATE tasks SET deleted_at = '2026-10-01T00:00:00Z' WHERE id = 2").run();
    await request(url(service.id, 2), { method: "PUT", headers: h });
    await env.DB.prepare("UPDATE tasks SET deleted_at = NULL WHERE id = 2").run();
    await request(url(service.id + 500, 3), { method: "PUT", headers: h });

    const events = await eventsSince(m);
    expect(events.map((e) => [e.service_id, e.task_id, e.action, e.outcome])).toEqual([
      [service.id, 1, "check", "applied"],
      [service.id, 1, "check", "no_change"],
      [service.id, 1, "uncheck", "applied"],
      [service.id, 1, "uncheck", "no_change"],
      [service.id, 2, "check", "not_found"],
      [service.id + 500, 3, "check", "service_changed"],
    ]);
    for (const e of events) {
      expect(e).toMatchObject({ user_pco_id: "dev-volunteer", user_name: "Test Volunteer", session_id: sessionIdOf(volunteer), tab_id: "tab-a1" });
      expect(Date.parse(String(e.created_at))).not.toBeNaN();
    }
  });

  it("ignores a malformed tab ID rather than storing it", async () => {
    const { service } = await getChecklist();
    const m = await marker();
    await request(url(service.id, 1), { method: "PUT", headers: headers(volunteer, "<script>alert(1)</script>") });
    expect((await eventsSince(m))[0].tab_id).toBeNull();
  });

  it("gives each sign-in its own session ID and keeps it when the cookie renews", async () => {
    const other = await signInAs("volunteer");
    expect(sessionIdOf(other)).not.toBe(sessionIdOf(volunteer));

    const { service } = await getChecklist();
    const m = await marker();
    const oldToken = await createSessionToken(env.SESSION_SECRET, "dev-volunteer", Math.floor(Date.now() / 1000) - 7200, "sid-kept");
    const res = await request(url(service.id, 1), { method: "PUT", headers: { Cookie: `session=${oldToken}` } });
    expect(res.headers.get("Set-Cookie")).toContain("session="); // renewed
    expect(sessionIdOf(res.headers.get("Set-Cookie")?.split(";")[0] ?? "")).toBe("sid-kept");
    expect((await eventsSince(m))[0].session_id).toBe("sid-kept");
  });

  it("is append-only: rows cannot be edited or deleted", async () => {
    const { service } = await getChecklist();
    await request(url(service.id, 1), { method: "PUT", headers: headers(volunteer) });
    await expect(env.DB.prepare("UPDATE checkoff_events SET user_name = 'someone else'").run()).rejects.toThrow(/append-only/);
    await expect(env.DB.prepare("DELETE FROM checkoff_events").run()).rejects.toThrow(/append-only/);
  });

  it("does not log requests that never reach the check-off logic (signed out or no access)", async () => {
    const { service } = await getChecklist();
    const m = await marker();
    await request(url(service.id, 1), { method: "PUT" });
    await request(url(service.id, 1), { method: "PUT", headers: headers(await signInAs("outsider")) });
    expect(await eventsSince(m)).toEqual([]);
  });
});

describe("reloading the page while a save is in progress (server)", () => {
  it("checks only the tapped task, once", async () => {
    const { service } = await getChecklist();
    const m = await marker();

    // The tap's PUT is in flight while the reloaded page fetches the checklist (twice, as a slow reload might).
    const [put, reloadA, reloadB] = await Promise.all([
      request(url(service.id, 2), { method: "PUT", headers: headers(volunteer, "tab-before-reload") }),
      request("/api/checklist", { headers: headers(volunteer, "tab-after-reload") }),
      request("/api/checklist", { headers: headers(volunteer, "tab-after-reload") }),
    ]);
    expect([put.status, reloadA.status, reloadB.status]).toEqual([200, 200, 200]);

    const tasks = (await getChecklist()).categories.flatMap((c) => c.sections.flatMap((s) => s.tasks));
    expect(tasks.filter((t) => t.checkoff !== null).map((t) => t.id)).toEqual([2]);
    expect((await env.DB.prepare("SELECT task_id FROM checkoffs").all()).results).toEqual([{ task_id: 2 }]);
    expect((await eventsSince(m)).map((e) => [e.task_id, e.action, e.outcome, e.tab_id])).toEqual([
      [2, "check", "applied", "tab-before-reload"],
    ]);
  });
});
