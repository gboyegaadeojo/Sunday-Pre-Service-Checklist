import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ChecklistResponse, ChecklistTask, CheckoffResponse } from "../src/shared/types";
import { currentServiceDate } from "../src/worker/lib/service-day";
import { request, signInAs, withCookie } from "./helpers";

// Seed facts used below: task 1 "Verify all server rack devices…" is in section 1 of category 1
// (Presentation / Computer Graphics); category 2 is Audio Engineer.

let volunteer: string;
let admin: string;

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM checkoffs"),
    env.DB.prepare("DELETE FROM resets"),
    env.DB.prepare("DELETE FROM services"),
    env.DB.prepare("UPDATE settings SET value = 'America/Winnipeg' WHERE key = 'time_zone'"),
    env.DB.prepare("UPDATE settings SET value = '0' WHERE key = 'service_weekday'"),
  ]);
  volunteer = await signInAs("volunteer");
  admin = await signInAs("admin");
});

afterEach(async () => {
  await env.DB.batch([
    env.DB.prepare("UPDATE tasks SET section_id = 1, deleted_at = NULL WHERE id = 1"),
    env.DB.prepare("UPDATE task_lists SET is_default = 1 WHERE id = 1"),
  ]);
});

const getChecklist = async (cookie = volunteer) => {
  const res = await request("/api/checklist", withCookie(cookie));
  expect(res.status).toBe(200);
  return res.json<ChecklistResponse>();
};

const findTask = (body: ChecklistResponse, id: number): { task: ChecklistTask; category: string; section: string } => {
  for (const c of body.categories)
    for (const s of c.sections)
      for (const t of s.tasks) if (t.id === id) return { task: t, category: c.name, section: s.name };
  throw new Error(`task ${id} not in checklist`);
};

const checkoffUrl = (serviceId: number, taskId: number) => `/api/services/${serviceId}/tasks/${taskId}/checkoff`;
const check = (cookie: string, serviceId: number, taskId = 1) => request(checkoffUrl(serviceId, taskId), { method: "PUT", ...withCookie(cookie) });
const uncheck = (cookie: string, serviceId: number, taskId = 1) =>
  request(checkoffUrl(serviceId, taskId), { method: "DELETE", ...withCookie(cookie) });

describe("GET /api/checklist: current service (US-07)", () => {
  it("creates the service for the configured service day, with every task unchecked", async () => {
    const body = await getChecklist();
    const expected = currentServiceDate(new Date(), "America/Winnipeg", 0);
    expect(body.service).toMatchObject({ date: expected.date, isToday: expected.isToday, published: false, timeZone: "America/Winnipeg" });
    expect(body.categories.flatMap((c) => c.sections.flatMap((s) => s.tasks)).every((t) => t.checkoff === null)).toBe(true);

    const again = await getChecklist();
    expect(again.service.id).toBe(body.service.id);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM services").first<{ n: number }>())?.n).toBe(1);
  });

  it("follows the service weekday setting (US-11a)", async () => {
    await env.DB.prepare("UPDATE settings SET value = '3' WHERE key = 'service_weekday'").run();
    const body = await getChecklist();
    expect(body.service.date).toBe(currentServiceDate(new Date(), "America/Winnipeg", 3).date);
  });

  it("fails loudly instead of guessing when the calendar settings are invalid", async () => {
    await env.DB.prepare("UPDATE settings SET value = 'Not/AZone' WHERE key = 'time_zone'").run();
    expect((await request("/api/checklist", withCookie(volunteer))).status).toBe(500);
  });

  it("keeps the service's list even if the default list changes later", async () => {
    const first = await getChecklist();
    await env.DB.prepare("UPDATE task_lists SET is_default = 0 WHERE id = 1").run();
    const again = await getChecklist();
    expect(again.service.id).toBe(first.service.id);
    expect(again.list.id).toBe(1);
  });
});

describe("checking off tasks (US-06)", () => {
  it("records who and when, and shows it to everyone", async () => {
    const { service } = await getChecklist();
    const res = await check(volunteer, service.id);
    expect(res.status).toBe(200);
    const { checkoff } = await res.json<CheckoffResponse>();
    expect(checkoff?.by).toBe("Test Volunteer");
    expect(Date.parse(checkoff?.at ?? "")).not.toBeNaN();

    const seenByAdmin = findTask(await getChecklist(admin), 1).task.checkoff;
    expect(seenByAdmin).toEqual(checkoff);
  });

  it("snapshots task text, department and section", async () => {
    const { service } = await getChecklist();
    await check(volunteer, service.id);
    const row = await env.DB.prepare(
      `SELECT task_text_snapshot, category_id_snapshot, category_name_snapshot, section_id_snapshot, section_name_snapshot,
              checked_by_pco_id, checked_by_name FROM checkoffs`,
    ).first();
    expect(row).toEqual({
      task_text_snapshot: "Verify all server rack devices are powered on, including the Mac and supporting hardware",
      category_id_snapshot: 1,
      category_name_snapshot: "Presentation / Computer Graphics",
      section_id_snapshot: 1,
      section_name_snapshot: "Power & Initial System Check",
      checked_by_pco_id: "dev-volunteer",
      checked_by_name: "Test Volunteer",
    });
  });

  it("keeps the first check-off when the task is checked again, by anyone", async () => {
    const { service } = await getChecklist();
    await check(volunteer, service.id);
    const second = await (await check(admin, service.id)).json<CheckoffResponse>();
    expect(second.checkoff?.by).toBe("Test Volunteer");
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM checkoffs").first<{ n: number }>())?.n).toBe(1);
  });

  it("unchecks, recording who and when, and a re-check starts a new record", async () => {
    const { service } = await getChecklist();
    await check(volunteer, service.id);
    const res = await uncheck(admin, service.id);
    expect(await res.json()).toEqual({ checkoff: null });
    expect(findTask(await getChecklist(), 1).task.checkoff).toBeNull();

    const unchecked = await env.DB.prepare("SELECT unchecked_by_pco_id, unchecked_by_name, unchecked_at FROM checkoffs").first<{
      unchecked_by_pco_id: string;
      unchecked_by_name: string;
      unchecked_at: string;
    }>();
    expect(unchecked).toMatchObject({ unchecked_by_pco_id: "dev-admin", unchecked_by_name: "Test Admin" });
    expect(unchecked?.unchecked_at).toBeTruthy();

    await check(admin, service.id);
    expect(findTask(await getChecklist(), 1).task.checkoff?.by).toBe("Test Admin");
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM checkoffs").first<{ n: number }>())?.n).toBe(2);
  });

  it("treats unchecking an unchecked task as a no-op", async () => {
    const { service } = await getChecklist();
    expect((await uncheck(volunteer, service.id)).status).toBe(200);
  });

  it("keeps a check-off when the task is moved to another department mid-service (US-13)", async () => {
    const { service } = await getChecklist();
    await check(volunteer, service.id);
    const audioSection = await env.DB.prepare("SELECT id, name FROM sections WHERE category_id = 2 ORDER BY sort_order LIMIT 1").first<{
      id: number;
      name: string;
    }>();
    await env.DB.prepare("UPDATE tasks SET section_id = ? WHERE id = 1").bind(audioSection?.id).run();

    const moved = findTask(await getChecklist(), 1);
    expect(moved.category).toBe("Audio Engineer");
    expect(moved.task.checkoff?.by).toBe("Test Volunteer");
    expect(await env.DB.prepare("SELECT category_name_snapshot FROM checkoffs").first()).toEqual({
      category_name_snapshot: "Presentation / Computer Graphics",
    });
  });
});

describe("check-off guards", () => {
  it("rejects a service that is no longer current with 409", async () => {
    const { service } = await getChecklist();
    const res = await check(volunteer, service.id + 1000);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "service_changed" });
  });

  it("rejects deleted tasks and tasks from another list", async () => {
    const { service } = await getChecklist();
    await env.DB.prepare("UPDATE tasks SET deleted_at = '2026-10-01T00:00:00Z' WHERE id = 1").run();
    expect((await check(volunteer, service.id, 1)).status).toBe(404);
    expect((await check(volunteer, service.id, 999999)).status).toBe(404);
    expect((await check(volunteer, service.id, Number.NaN)).status).toBe(404);
  });

  it("requires a session and media-team access (US-02, US-17)", async () => {
    const { service } = await getChecklist();
    expect((await request(checkoffUrl(service.id, 1), { method: "PUT" })).status).toBe(401);
    expect((await check(await signInAs("outsider"), service.id)).status).toBe(403);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM checkoffs").first<{ n: number }>())?.n).toBe(0);
  });
});
