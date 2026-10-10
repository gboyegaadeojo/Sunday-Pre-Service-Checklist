// Stage 7b: access by team membership (US-02) and the department view (US-05), with the fake schedule source and
// the build plan's expected mapping. Uses the seed checklist's department names, as that mapping does.
import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ChecklistResponse, MeResponse } from "../src/shared/types";
import { request, signInAs, withCookie } from "./helpers";

/** The seed department's ID by name. */
const dept = async (name: string) =>
  (await env.DB.prepare("SELECT id FROM categories WHERE list_id = 1 AND name = ? AND deleted_at IS NULL").bind(name).first<{ id: number }>())
    ?.id as number;

const EXPECTED: [string, string, boolean][] = [
  ["pos-audio", "Audio Engineer", false],
  ["pos-camera-1", "Camera Operators", false],
  ["pos-camera-2", "Camera Operators", false],
  ["pos-propresenter", "Presentation / Computer Graphics", false],
  ["pos-production-director", "Director (Switcher)", false],
  ["pos-miscellaneous", "Miscellaneous", false],
  ["pos-technical-director", "Technical Director", true],
];

/** Team mapping as an Admin would set it up (Stage 7a), written directly. */
async function setUpMapping() {
  const statements = [
    env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('schedule_source', 'fake'), ('schedule_service_type', 'st-sunday')"),
  ];
  for (const [position, name, seesAll] of EXPECTED) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO team_links (source, team_external_id, position_external_id, category_id, team_name, position_name, sees_all)
         VALUES ('fake', 'team-production', ?, ?, 'Production', ?, ?)`,
      ).bind(position, await dept(name), position, seesAll ? 1 : 0),
    );
  }
  await env.DB.batch(statements);
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM checkoffs"),
    env.DB.prepare("DELETE FROM resets"),
    env.DB.prepare("DELETE FROM services"),
    env.DB.prepare("DELETE FROM team_links"), // the shared test setup's link: this file maps its own
  ]);
  await setUpMapping();
});
afterEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM team_links"),
    env.DB.prepare("DELETE FROM settings WHERE key IN ('schedule_source', 'schedule_service_type')"),
    env.DB.prepare("DELETE FROM source_cache"),
    env.DB.prepare("DELETE FROM dev_state"),
  ]);
});

const me = async (cookie: string) => (await (await request("/api/auth/me", withCookie(cookie))).json<MeResponse>()).user;
const checklist = async (cookie: string) => {
  const res = await request("/api/checklist", withCookie(cookie));
  expect(res.status).toBe(200);
  return res.json<ChecklistResponse>();
};
/** The view with department IDs turned into names. */
const viewOf = async (key: string) => {
  const body = await checklist(await signInAs(key));
  const name = (id: number) => body.categories.find((c) => c.id === id)?.name;
  return { mode: body.view.mode, own: body.view.own.map(name), note: body.view.note };
};

describe("access by team membership (US-02)", () => {
  it("lets in anyone on a linked team, scheduled or not", async () => {
    const volunteer = await signInAs("volunteer"); // on Production, not scheduled this week
    expect((await me(volunteer)).hasAccess).toBe(true);
    expect((await request("/api/checklist", withCookie(volunteer))).status).toBe(200);
  });

  it("keeps out someone only on a team that isn't linked", async () => {
    const outsider = await signInAs("outsider"); // on the Worship Band
    expect((await me(outsider)).hasAccess).toBe(false);
    expect((await request("/api/checklist", withCookie(outsider))).status).toBe(403);
  });

  it("always lets in Admins and Directors, team or not", async () => {
    expect((await me(await signInAs("director"))).hasAccess).toBe(true);
    expect((await me(await signInAs("admin"))).hasAccess).toBe(true);
  });

  it("re-checks on each page load: leaving the linked teams ends access, and stamps the check", async () => {
    const volunteer = await signInAs("volunteer");
    expect((await me(volunteer)).hasAccess).toBe(true);
    const stamp = async () => (await env.DB.prepare("SELECT team_verified_at AS t FROM users WHERE display_name = 'Test Volunteer'").first<{ t: string | null }>())?.t;
    expect(await stamp()).not.toBeNull();

    // Production unlinked except for a team nobody here is on: the volunteer is no longer on a linked team.
    await env.DB.batch([
      env.DB.prepare("DELETE FROM team_links"),
      env.DB.prepare("INSERT INTO team_links (source, team_external_id, category_id, team_name) VALUES ('fake', 'team-elsewhere', ?, 'Elsewhere')").bind(await dept("Miscellaneous")),
    ]);
    expect((await me(volunteer)).hasAccess).toBe(false);
    expect(await stamp()).toBeNull();
    expect((await request("/api/checklist", withCookie(volunteer))).status).toBe(403);
  });

  it.each([
    ["no links yet", "DELETE FROM team_links"],
    ["no Service Type chosen", "DELETE FROM settings WHERE key = 'schedule_service_type'"],
  ])("until team mapping is set up (%s), lets in only Admins and Directors", async (_, sql) => {
    await env.DB.prepare(sql).run();
    const volunteer = await signInAs("volunteer");
    expect(await me(volunteer)).toMatchObject({ hasAccess: false, settingUp: true });
    expect("teamMappingPending" in (await me(volunteer))).toBe(false);
    const res = await request("/api/checklist", withCookie(volunteer));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "The app is being set up. Check back soon.", code: "no_access" });

    for (const key of ["admin", "director"]) {
      const user = await me(await signInAs(key));
      expect(user.hasAccess, key).toBe(true);
      expect("settingUp" in user, key).toBe(false);
      // They're told volunteers can't get in yet (design review #9).
      expect(user.teamMappingPending, key).toBe(true);
    }
    // Once set up, people's team membership decides again.
    await env.DB.prepare("DELETE FROM team_links").run();
    await setUpMapping();
    expect(await me(volunteer)).toEqual(expect.objectContaining({ hasAccess: true }));
    expect("settingUp" in (await me(volunteer))).toBe(false);
    expect("teamMappingPending" in (await me(await signInAs("admin")))).toBe(false);
  });
});

describe("which departments the checklist shows (US-05)", () => {
  it("shows a scheduled volunteer only their department", async () => {
    expect(await viewOf("camera2")).toEqual({ mode: "own", own: ["Camera Operators"], note: null });
  });

  it("shows all of their departments to someone in two positions, in checklist order", async () => {
    expect(await viewOf("audio-presentation")).toEqual({ mode: "own", own: ["Presentation / Computer Graphics", "Audio Engineer"], note: null });
  });

  it("lets a team member who isn't scheduled choose, saying why", async () => {
    expect(await viewOf("volunteer")).toEqual({ mode: "choose", own: [], note: "not_scheduled" });
  });

  it("lets someone whose position isn't linked choose, saying why", async () => {
    await env.DB.prepare("DELETE FROM team_links WHERE position_external_id = 'pos-camera-2'").run();
    expect(await viewOf("camera2")).toEqual({ mode: "choose", own: [], note: "not_linked" });
  });

  it("uses the team's link for a position without its own", async () => {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM team_links WHERE position_external_id = 'pos-camera-2'"),
      env.DB.prepare("INSERT INTO team_links (source, team_external_id, category_id, team_name) VALUES ('fake', 'team-production', ?, 'Production')").bind(await dept("Miscellaneous")),
    ]);
    expect(await viewOf("camera2")).toEqual({ mode: "own", own: ["Miscellaneous"], note: null });
  });

  it("shows everything to a position marked “sees all departments”, theirs first", async () => {
    expect(await viewOf("technical-director")).toEqual({ mode: "all", own: ["Technical Director"], note: null });
  });

  it("shows everything to Admins and Directors, their own departments first", async () => {
    expect(await viewOf("admin")).toEqual({ mode: "all", own: ["Director (Switcher)"], note: null });
    expect(await viewOf("director")).toEqual({ mode: "all", own: [], note: null });
  });

  it("always sends every department, so the progress view covers them all", async () => {
    const all = await checklist(await signInAs("admin"));
    const own = await checklist(await signInAs("camera2"));
    expect(own.categories.map((c) => c.id)).toEqual(all.categories.map((c) => c.id));
    expect(own.categories.length).toBeGreaterThan(1);
  });

  it("is a view only: a scheduled volunteer can check off a task in another department", async () => {
    const camera2 = await signInAs("camera2");
    const body = await checklist(camera2);
    const audio = body.categories.find((c) => c.name === "Audio Engineer");
    const task = audio?.sections[0].tasks[0];
    expect(task).toBeDefined();
    const res = await request(`/api/services/${body.service.id}/tasks/${task?.id}/checkoff`, { method: "PUT", ...withCookie(camera2) });
    expect(res.status).toBe(200);
  });
});

describe("the published plan", () => {
  it("marks the service published and records its plan", async () => {
    const body = await checklist(await signInAs("camera2"));
    expect(body.service.published).toBe(true);
    const row = await env.DB.prepare("SELECT plan_source, plan_external_id FROM services WHERE id = ?").bind(body.service.id).first();
    expect(row).toEqual({ plan_source: "fake", plan_external_id: `plan-st-sunday-${body.service.date}` });
  });

  it("without a plan, shows the not-published note and lets everyone choose, with no schedule note", async () => {
    await request("/api/dev/schedule", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unpublished: true }) });
    const body = await checklist(await signInAs("camera2"));
    expect(body.service.published).toBe(false);
    // The source's name comes with it, for the "No service is published in … yet" note (US-05, C22).
    expect(body.view).toEqual({ mode: "choose", own: [], note: null, source: "Planning Center (sample data)" });
    expect((await viewOf("admin")).mode).toBe("all");
  });
});
