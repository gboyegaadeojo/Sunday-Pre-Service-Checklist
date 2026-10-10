// Stage 7d: the current service's date comes from the schedule's plans (US-07). The earliest plan dated today or later,
// in the chosen Service Type, is the current service; with none published, the next service day. Everything that asks
// "which service is current" agrees: the checklist, the service record, history, the activity log and Settings.
// Uses the shared test mapping (Service Type "st-sunday") from test/apply-migrations.ts.
import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addDays, currentServiceDate, localDate } from "../src/shared/service-day";
import type { ActivityResponse, ChecklistResponse, HistoryResponse, SettingsResponse } from "../src/shared/types";
import { request, signInAs, withCookie } from "./helpers";

const TZ = "America/Winnipeg";
const now = () => new Date();
/** The next service day (Sunday in the seed settings) and today, in the church's time zone. */
const serviceDay = () => currentServiceDate(now(), TZ, 0).date;
const today = () => localDate(now(), TZ).date;
/** Two days after the service day: never a service day itself. */
const otherDay = () => addDays(serviceDay(), 2);

const schedule = async (state: unknown) => {
  const res = await request("/api/dev/schedule", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(state) });
  expect(res.status).toBe(204);
  await env.DB.prepare("DELETE FROM source_cache").run(); // as if the cached schedule had expired
};

let volunteer: string;
let admin: string;
beforeEach(async () => {
  await env.DB.batch([env.DB.prepare("DELETE FROM checkoffs"), env.DB.prepare("DELETE FROM resets"), env.DB.prepare("DELETE FROM services")]);
  volunteer = await signInAs("volunteer");
  admin = await signInAs("admin");
});
afterEach(async () => {
  await schedule({});
  await env.DB.prepare("UPDATE settings SET value = '0' WHERE key = 'service_weekday'").run();
});

const checklist = async () => (await request("/api/checklist", withCookie(volunteer))).json<ChecklistResponse>();
const settings = async () => (await request("/api/admin/settings", withCookie(admin))).json<SettingsResponse>();
const history = async () => (await request("/api/admin/history", withCookie(admin))).json<HistoryResponse>();

describe("the current service (US-07)", () => {
  it("is the service day's plan when one is published", async () => {
    const { service } = await checklist();
    expect(service).toMatchObject({ date: serviceDay(), published: true });
  });

  it("is the service day, unpublished, when no plan is published", async () => {
    await schedule({ unpublished: true });
    const { service } = await checklist();
    expect(service).toMatchObject({ date: serviceDay(), published: false });
  });

  it("follows a plan on another day, wherever it falls", async () => {
    await schedule({ unpublished: true, extraPlans: [{ date: otherDay() }] });
    const { service } = await checklist();
    expect(service).toMatchObject({ date: otherDay(), published: true, isToday: false });
    const row = await env.DB.prepare("SELECT plan_external_id FROM services WHERE id = ?").bind(service.id).first();
    expect(row).toEqual({ plan_external_id: `plan-st-sunday-${otherDay()}` });
  });

  it("puts an earlier plan (a special service) ahead of the service day, current until its midnight", async () => {
    if (today() === serviceDay()) return; // on a service day, today's plan is the service day's
    await schedule({ extraPlans: [{ date: today() }] });
    const { service } = await checklist();
    expect(service).toMatchObject({ date: today(), isToday: true, published: true });
  });

  it("goes back to the service day when the plan is withdrawn, clearing it from the earlier service", async () => {
    await schedule({ unpublished: true, extraPlans: [{ date: otherDay() }] });
    const planned = (await checklist()).service;
    await schedule({});
    const { service } = await checklist();
    expect(service.date).toBe(serviceDay());
    const old = await env.DB.prepare("SELECT plan_external_id FROM services WHERE id = ?").bind(planned.id).first();
    expect(old).toEqual({ plan_external_id: null });
    expect((await settings()).currentService).toMatchObject({ date: serviceDay() });
  });

  it("keeps the last known plan's date during an outage (US-04a)", async () => {
    await schedule({ unpublished: true, extraPlans: [{ date: otherDay() }] });
    await checklist();
    await schedule({ unpublished: true, extraPlans: [{ date: otherDay() }], down: true });
    const body = await checklist();
    expect(body.service).toMatchObject({ date: otherDay(), published: true });
    expect(body.view.note).toBe("schedule_unavailable");
  });

  it("isn't moved by a service-day change while a plan decides it", async () => {
    await schedule({ unpublished: true, extraPlans: [{ date: otherDay() }] });
    await checklist();
    await env.DB.prepare("UPDATE settings SET value = '3' WHERE key = 'service_weekday'").run();
    expect((await checklist()).service.date).toBe(otherDay());
    expect((await settings()).currentService).toMatchObject({ date: otherDay(), fromPlan: true });
  });
});

describe("everything agrees on which service is current", () => {
  it("history leaves it out, the activity log and Settings point at it", async () => {
    await schedule({ unpublished: true, extraPlans: [{ date: otherDay() }] });
    const { service } = await checklist();
    expect((await history()).services.map((s) => s.id)).not.toContain(service.id);
    const log = await (await request("/api/services/current/events", withCookie(admin))).json<ActivityResponse>();
    expect(log.service).toMatchObject({ id: service.id, date: otherDay() });
    expect((await settings()).currentService).toMatchObject({ date: otherDay(), fromPlan: true });
  });

  it("checklist edits update that service's record (US-07b)", async () => {
    await schedule({ unpublished: true, extraPlans: [{ date: otherDay() }] });
    const { service, categories } = await checklist();
    const task = categories[0].sections[0].tasks[0];
    const edit = (text: string) =>
      request(`/api/admin/tasks/${task.id}`, { method: "PATCH", headers: { Cookie: admin, "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    expect((await edit(`${task.text} (edited)`)).status).toBe(204);
    const recorded = await env.DB.prepare("SELECT text FROM service_tasks WHERE service_id = ? AND task_id = ?").bind(service.id, task.id).first();
    expect(recorded).toEqual({ text: `${task.text} (edited)` });
    expect((await edit(task.text)).status).toBe(204);
  });

  it("check-offs go to the plan's service", async () => {
    await schedule({ unpublished: true, extraPlans: [{ date: otherDay() }] });
    const { service, categories } = await checklist();
    const task = categories[0].sections[0].tasks[0];
    expect((await request(`/api/services/${service.id}/tasks/${task.id}/checkoff`, { method: "PUT", ...withCookie(volunteer) })).status).toBe(200);
  });
});
