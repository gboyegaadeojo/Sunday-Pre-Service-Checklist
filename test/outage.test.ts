// Stage 7c: when the schedule source (Planning Center) can't be reached, nothing blocks on Sunday morning (US-04a,
// US-04b). People confirmed on a media team in the last 90 days carry on; everyone picks their department; check-offs
// work; someone never confirmed is told to try again; Planning Center sign-in says it's unavailable.
// Uses the shared test mapping (the fake Production team linked) from test/apply-migrations.ts.
import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ChecklistResponse, MeResponse } from "../src/shared/types";
import { request, signInAs, userIdOf, withCookie } from "./helpers";

const adjust = (state: unknown) =>
  request("/api/dev/schedule", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(state) });
const down = async () => expect((await adjust({ down: true })).status).toBe(204);

beforeEach(async () => {
  await env.DB.batch([env.DB.prepare("DELETE FROM checkoffs"), env.DB.prepare("DELETE FROM resets"), env.DB.prepare("DELETE FROM services")]);
});
afterEach(async () => {
  await adjust({});
  await env.DB.prepare("DELETE FROM source_cache").run();
});

const me = async (cookie: string) => (await (await request("/api/auth/me", withCookie(cookie))).json<MeResponse>()).user;
const checklist = (cookie: string) => request("/api/checklist", withCookie(cookie));
/** Sets when the user was last confirmed on a media team, `days` ago (null: never). */
const verified = async (key: string, days: number | null) =>
  env.DB.prepare("UPDATE users SET team_verified_at = ? WHERE id = ?")
    .bind(days === null ? null : new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(), await userIdOf(key))
    .run();

describe("schedule lookup fails, sign-in works (US-04a)", () => {
  it("lets in someone confirmed recently: all departments, a banner, and check-offs as usual", async () => {
    const volunteer = await signInAs("volunteer");
    await down();
    expect(await me(volunteer)).toMatchObject({ hasAccess: true });
    expect("unreachable" in (await me(volunteer))).toBe(false);

    const res = await checklist(volunteer);
    expect(res.status).toBe(200);
    const body = await res.json<ChecklistResponse>();
    expect(body.view).toEqual({ mode: "choose", own: [], note: "schedule_unavailable", source: "Planning Center (sample data)" });
    expect(body.categories.length).toBeGreaterThan(1);

    const task = body.categories[1].sections[0].tasks[0];
    expect((await request(`/api/services/${body.service.id}/tasks/${task.id}/checkoff`, { method: "PUT", ...withCookie(volunteer) })).status).toBe(200);
  });

  it("still shows a scheduled volunteer every department to choose from (their schedule can't be loaded)", async () => {
    const camera2 = await signInAs("camera2");
    expect((await (await checklist(camera2)).json<ChecklistResponse>()).view.mode).toBe("own"); // while it's up
    await adjust({ down: true });
    expect((await (await checklist(camera2)).json<ChecklistResponse>()).view).toMatchObject({ mode: "choose", note: "schedule_unavailable" });
  });

  it("shows Admins and Directors everything, with the banner", async () => {
    await down();
    for (const key of ["admin", "director"]) {
      const body = await (await checklist(await signInAs(key))).json<ChecklistResponse>();
      expect(body.view, key).toMatchObject({ mode: "all", note: "schedule_unavailable" });
    }
  });

  it("keeps a plan recorded earlier, so the service still shows as published", async () => {
    const volunteer = await signInAs("volunteer");
    expect((await (await checklist(volunteer)).json<ChecklistResponse>()).service.published).toBe(true);
    await down();
    expect((await (await checklist(volunteer)).json<ChecklistResponse>()).service.published).toBe(true);
  });

  it("tells someone never confirmed to try again in a few minutes", async () => {
    const volunteer = await signInAs("volunteer");
    await down();
    await verified("volunteer", null);
    expect(await me(volunteer)).toMatchObject({ hasAccess: false, unreachable: "Planning Center (sample data)" });
    expect((await checklist(volunteer)).status).toBe(403);
  });

  it("counts a confirmation for 90 days", async () => {
    const volunteer = await signInAs("volunteer");
    await down();
    await verified("volunteer", 89);
    expect((await me(volunteer)).hasAccess).toBe(true);
    await verified("volunteer", 91);
    expect(await me(volunteer)).toMatchObject({ hasAccess: false, unreachable: "Planning Center (sample data)" });
  });

  it("confirms again as soon as the source is back", async () => {
    const volunteer = await signInAs("volunteer");
    await down();
    await verified("volunteer", 91);
    expect((await me(volunteer)).hasAccess).toBe(false);
    // Back up: the remembered outage is cleared, so the very next page load confirms them again.
    expect((await adjust({})).status).toBe(204);
    expect((await me(volunteer)).hasAccess).toBe(true);
  });

  it("always lets Admins and Directors in, and never tells them to try again", async () => {
    await down();
    for (const key of ["admin", "director"]) {
      const user = await me(await signInAs(key));
      expect(user.hasAccess, key).toBe(true);
      expect("unreachable" in user, key).toBe(false);
    }
  });

  it("explains the outage on the mapping screen without losing any links", async () => {
    const admin = await signInAs("admin");
    await down();
    const res = await request("/api/admin/mapping", withCookie(admin));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("Links already made keep working") });
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM team_links").first("n")).toBeGreaterThan(0);
  });
});

describe("a source that answers too slowly counts as down (5 seconds)", () => {
  it("stops waiting after 5 seconds, then doesn't wait again for a minute", { timeout: 20000 }, async () => {
    const volunteer = await signInAs("volunteer");
    await env.DB.prepare("DELETE FROM source_cache").run();
    await adjust({ delayMs: 6000 });

    let started = Date.now();
    const first = await me(volunteer);
    const waited = Date.now() - started;
    expect(first.hasAccess).toBe(true); // confirmed at sign-in, so the outage rule lets them in
    expect(waited).toBeGreaterThanOrEqual(4900);
    expect(waited).toBeLessThan(6000);

    started = Date.now();
    const body = await (await checklist(volunteer)).json<ChecklistResponse>();
    expect(Date.now() - started).toBeLessThan(1000); // remembered as unreachable: no second wait
    expect(body.view.note).toBe("schedule_unavailable");
  });
});

describe("Planning Center sign-in is down (US-04b)", () => {
  const signIn = (viaPlanningCenter: boolean) =>
    request("/api/dev/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "volunteer", viaPlanningCenter }),
    });

  it("says sign-in is unavailable, while existing sessions carry on", async () => {
    const existing = await signInAs("volunteer");
    await down();
    const res = await signIn(true);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Planning Center sign-in is temporarily unavailable. Please try again shortly." });
    expect(res.headers.get("Set-Cookie")).toBeNull();

    expect((await me(existing)).hasAccess).toBe(true);
    expect((await checklist(existing)).status).toBe(200);
  });

  it("signs in through Planning Center as usual when it's up", async () => {
    expect((await signIn(true)).status).toBe(204);
  });
});
