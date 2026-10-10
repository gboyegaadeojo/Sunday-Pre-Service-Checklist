// Stage 5d.2: church settings (US-11a). Admin only; validated; only changed values are saved and logged,
// append-only, in the same transaction; branding is public, with cleared values left out; the calendar
// settings decide the current service.
import { env } from "cloudflare:test";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type {
  ApiErrorBody,
  BrandingResponse,
  ChecklistResponse,
  SettingsEditsResponse,
  SettingsResponse,
  UpdateSettingsRequest,
  UpdateSettingsResponse,
} from "../src/shared/types";
import { currentServiceDate } from "../src/shared/service-day";
import { request, signInAs, withCookie } from "./helpers";

const SEED: UpdateSettingsRequest = {
  timeZone: "America/Winnipeg",
  serviceWeekday: 0,
  shortName: "IFC",
  teamName: "IFC Production",
  appName: "Pre-Service Checklist",
};

const cookies = { admin: "", director: "", volunteer: "" };
beforeAll(async () => {
  cookies.admin = await signInAs("admin");
  cookies.director = await signInAs("director");
  cookies.volunteer = await signInAs("volunteer");
});

const call = (cookie: string, method: string, path = "", body?: unknown) =>
  request(`/api/admin/settings${path}`, {
    method,
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const get = async () => (await (await call(cookies.admin, "GET")).json()) as SettingsResponse;
const put = (body: unknown) => call(cookies.admin, "PUT", "", body);

let marker: number;
beforeEach(async () => {
  marker = (await env.DB.prepare("SELECT COALESCE(MAX(id), 0) AS id FROM settings_events").first<{ id: number }>())?.id ?? 0;
});
/** This test's settings log entries, oldest first. */
const events = async () =>
  ((await (await call(cookies.admin, "GET", "/events")).json()) as SettingsEditsResponse).events.filter((e) => e.id > marker).reverse();

// Back to the seed values (the log keeps its rows: it's append-only).
afterEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM checkoffs"),
    env.DB.prepare("DELETE FROM resets"),
    env.DB.prepare("DELETE FROM services"),
    ...Object.entries({
      time_zone: SEED.timeZone,
      service_weekday: String(SEED.serviceWeekday),
      church_short_name: SEED.shortName,
      team_name: SEED.teamName,
      app_name: SEED.appName,
    }).map(([k, v]) => env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").bind(k, v)),
  ]);
});

describe("access", () => {
  it("is Admin only, on every endpoint", async () => {
    for (const [method, path, body] of [["GET", ""], ["PUT", "", SEED], ["GET", "/events"]] as const) {
      expect((await call(cookies.director, method, path, body)).status, `${method} ${path} as Director`).toBe(403);
      expect((await call(cookies.volunteer, method, path, body)).status, `${method} ${path} as Volunteer`).toBe(403);
      expect((await request(`/api/admin/settings${path}`, { method })).status, `${method} ${path} signed out`).toBe(401);
    }
  });
});

describe("reading and saving", () => {
  it("returns the seeded settings and the current service", async () => {
    const s = await get();
    expect(s.settings).toEqual(SEED);
    // No service yet, so no plan recorded: the service day decides (US-07).
    expect(s.currentService).toEqual({ date: currentServiceDate(new Date(), "America/Winnipeg", 0).date, checkedCount: 0, fromPlan: false });
  });

  it("saves and logs only what changed, trimmed, with who made the change", async () => {
    const res = await put({ ...SEED, teamName: "  Media Team ", serviceWeekday: 6 });
    expect(res.status).toBe(200);
    const body = (await res.json()) as UpdateSettingsResponse;
    expect(body.changed).toEqual(["serviceWeekday", "teamName"]);
    expect(body.currentServiceDate).toBe(currentServiceDate(new Date(), "America/Winnipeg", 6).date);
    expect((await get()).settings).toEqual({ ...SEED, teamName: "Media Team", serviceWeekday: 6 });

    const [entry, ...rest] = await events();
    expect(rest).toEqual([]);
    expect(entry.before).toEqual({ serviceWeekday: 0, teamName: "IFC Production" });
    expect(entry.after).toEqual({ serviceWeekday: 6, teamName: "Media Team" });
    expect(entry.user).toBe("Test Admin");
    expect(entry.sessionId).toBeTruthy();
  });

  it("saving unchanged values writes and logs nothing", async () => {
    const body = (await (await put(SEED)).json()) as UpdateSettingsResponse;
    expect(body.changed).toEqual([]);
    expect(await events()).toEqual([]);
  });

  it("refuses invalid values and changes nothing", async () => {
    const bad: [Partial<UpdateSettingsRequest> | Record<string, unknown>, string][] = [
      [{ timeZone: "Mars/Olympus_Mons" }, "Choose a time zone from the list, e.g. America/Winnipeg."],
      [{ timeZone: "+05:00" }, "Choose a time zone from the list, e.g. America/Winnipeg."],
      [{ timeZone: "" }, "Choose a time zone from the list, e.g. America/Winnipeg."],
      [{ serviceWeekday: 7 }, "Choose the service day."],
      [{ serviceWeekday: "0" }, "Choose the service day."],
      [{ shortName: "ABCDEFGHI" }, "Short name can be at most 8 characters."],
      [{ teamName: "x".repeat(61) }, "Team name can be at most 60 characters."],
      [{ appName: "x".repeat(61) }, "App name can be at most 60 characters."],
    ];
    for (const [patch, message] of bad) {
      const res = await put({ ...SEED, ...patch });
      expect(res.status, JSON.stringify(patch)).toBe(400);
      expect(((await res.json()) as ApiErrorBody).error).toBe(message);
    }
    expect((await get()).settings).toEqual(SEED);
    expect(await events()).toEqual([]);
  });

  it("accepts another real time zone", async () => {
    expect((await put({ ...SEED, timeZone: "Europe/London" })).status).toBe(200);
    expect((await get()).settings.timeZone).toBe("Europe/London");
  });
});

describe("effects", () => {
  it("branding is public, and a cleared value is left out", async () => {
    await put({ ...SEED, shortName: "", teamName: "Media Team" });
    const branding = (await (await request("/api/branding")).json()) as BrandingResponse;
    expect(branding).toEqual({ shortName: null, teamName: "Media Team", appName: "Pre-Service Checklist" });
  });

  it("the service weekday decides the current service", async () => {
    await put({ ...SEED, serviceWeekday: 3 });
    const checklist = (await (await request("/api/checklist", withCookie(cookies.volunteer))).json()) as ChecklistResponse;
    expect(checklist.service.date).toBe(currentServiceDate(new Date(), "America/Winnipeg", 3).date);
  });

  it("counts the tasks checked on the current service, so the screen can warn before moving it", async () => {
    const checklist = (await (await request("/api/checklist", withCookie(cookies.volunteer))).json()) as ChecklistResponse;
    const task = checklist.categories[0].sections[0].tasks[0].id;
    const res = await request(`/api/services/${checklist.service.id}/tasks/${task}/checkoff`, { method: "PUT", ...withCookie(cookies.volunteer) });
    expect(res.ok).toBe(true);
    expect((await get()).currentService?.checkedCount).toBe(1);
    // An unchecked task doesn't count.
    await request(`/api/services/${checklist.service.id}/tasks/${task}/checkoff`, { method: "DELETE", ...withCookie(cookies.volunteer) });
    expect((await get()).currentService?.checkedCount).toBe(0);
  });
});

describe("the settings log", () => {
  it("is append-only", async () => {
    await put({ ...SEED, appName: "Checklist" });
    await expect(env.DB.prepare("UPDATE settings_events SET user_name = 'x'").run()).rejects.toThrow(/append-only/);
    await expect(env.DB.prepare("DELETE FROM settings_events").run()).rejects.toThrow(/append-only/);
  });
});
