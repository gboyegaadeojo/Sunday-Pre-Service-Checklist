// Scheduled Director (Stage 12, requirements C41): people scheduled (not declined) in a position an Admin marked "Gets
// the Director role while scheduled" are Directors for the current service period only, enforced by the server on
// every request. Only Director, never Admin; permanent Directors are untouched; an outage keeps the last grant; a
// position name that matches nothing (after a rename) grants nothing. Every grant and end is in the role log.
//
// Time: the server uses the real clock, so the date-based rules call the grant functions with a chosen date, and the
// request tests prove the server enforces whatever grants exist.
import { env } from "cloudflare:test";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ChecklistResponse, MeResponse, RoleEditsResponse } from "../src/shared/types";
import { activeDirectorGrant, syncScheduledDirectors } from "../src/worker/db/scheduled-directors";
import { getCurrentService } from "../src/worker/db/services";
import { createFakeScheduleSource } from "../src/worker/dev/fake-schedule";
import { createPlanningCenterSchedule } from "../src/worker/sources/planning-center/schedule";
import { request, signInAs, userIdOf } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;
const TD = "pos-technical-director";
const cookies = { admin: "", td: "", volunteer: "", director: "" };
const fake = () => createFakeScheduleSource(env.DB);

beforeAll(async () => {
  cookies.admin = await signInAs("admin");
  cookies.td = await signInAs("technical-director");
  cookies.volunteer = await signInAs("volunteer");
  cookies.director = await signInAs("director");
});

/** The position links these tests use, under the shared setup's team link (test/apply-migrations.ts). */
const DEPARTMENT = "(SELECT id FROM categories WHERE list_id = 1 ORDER BY sort_order DESC LIMIT 1)";
let marker = 0;
beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM scheduled_directors"),
    env.DB.prepare("DELETE FROM team_links WHERE position_external_id IS NOT NULL"),
    env.DB.prepare("DELETE FROM source_cache"),
    env.DB.prepare("DELETE FROM dev_state"),
    env.DB.prepare(
      `INSERT INTO team_links (source, team_external_id, position_external_id, category_id, team_name, position_name, grants_director)
       VALUES ('fake', 'team-production', ?1, ${DEPARTMENT}, 'Production', 'Technical Director', 1),
              ('fake', 'team-production', 'pos-production-director', ${DEPARTMENT}, 'Production', 'Production Director', 0)`,
    ).bind(TD),
  ]);
  marker = (await env.DB.prepare("SELECT COALESCE(MAX(id), 0) AS id FROM role_events").first<{ id: number }>())?.id ?? 0;
});

const me = async (cookie: string) => ((await (await request("/api/auth/me", { headers: { Cookie: cookie } })).json()) as MeResponse).user;
const checklist = async (cookie: string) => (await (await request("/api/checklist", { headers: { Cookie: cookie } })).json()) as ChecklistResponse;
const tryReset = async (cookie: string) => {
  const { service } = await checklist(cookies.admin);
  return request(`/api/services/${service.id}/reset`, { method: "POST", headers: { Cookie: cookie } });
};
const grants = async () =>
  (await env.DB.prepare("SELECT user_id, service_id, ended_at, position_name FROM scheduled_directors ORDER BY id").all<{
    user_id: number;
    service_id: number;
    ended_at: string | null;
    position_name: string;
  }>()).results;
const roleLog = async () =>
  ((await (await request("/api/admin/users/events", { headers: { Cookie: cookies.admin } })).json()) as RoleEditsResponse).events
    .filter((e) => e.id > marker)
    .reverse();
const adjustSchedule = async (state: unknown) =>
  expect((await request("/api/dev/schedule", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(state) })).status).toBe(204);

describe("a scheduled Technical Director", () => {
  it("gets Director while scheduled, enforced by the server, and the grant is logged", async () => {
    // Before the schedule is checked: no role, so the server refuses reset.
    expect((await tryReset(cookies.td)).status).toBe(403);

    const user = await me(cookies.td); // each page load checks the schedule
    expect(user.isDirector).toBe(true);
    expect(user.isAdmin).toBe(false);
    expect(user.scheduledDirector).toMatchObject({ position: "Production › Technical Director" });
    expect((await checklist(cookies.td)).service.reset).toBeDefined(); // staff-only data
    expect((await tryReset(cookies.td)).status).not.toBe(403);

    // Someone not scheduled in a marked position stays as they are.
    expect((await me(cookies.volunteer)).isDirector).toBe(false);
    expect((await tryReset(cookies.volunteer)).status).toBe(403);

    // The stored role is unchanged: the grant is separate from the permanent flag.
    expect(await env.DB.prepare("SELECT is_director FROM users WHERE id = ?").bind(await userIdOf("technical-director")).first("is_director")).toBe(0);
    expect(await roleLog()).toEqual([
      expect.objectContaining({
        target: "Test Technical Director",
        before: { scheduledDirector: null },
        after: { scheduledDirector: { position: "Production › Technical Director", serviceDate: expect.any(String) } },
        user: "Planning Center (sample data) schedule",
      }),
    ]);
  });

  it("loses it when the next service becomes current, and the end is logged", async () => {
    const now = new Date();
    const td = await userIdOf("technical-director");
    expect(await syncScheduledDirectors(env.DB, fake(), now)).toBe("synced");
    const first = (await grants())[0];
    expect(await activeDirectorGrant(env.DB, td, now)).not.toBeNull();

    // A week on, the next service is current: last week's grant no longer counts, even before the next check...
    const nextWeek = new Date(now.getTime() + 7 * DAY);
    await getCurrentService(env.DB, nextWeek, fake());
    expect(await activeDirectorGrant(env.DB, td, nextWeek)).toBeNull();
    // ...and the next check ends it (logged), then grants the new week's, since they're scheduled again.
    await syncScheduledDirectors(env.DB, fake(), nextWeek);
    const after = await grants();
    expect(after[0]).toMatchObject({ service_id: first.service_id, ended_at: expect.any(String) });
    expect(after[1]).toMatchObject({ user_id: td, ended_at: null });
    expect(after[1].service_id).not.toBe(first.service_id);
    expect((await roleLog()).map((e) => [e.after.scheduledDirector === null ? "end" : "grant", e.after.reason ?? null])).toEqual([
      ["grant", null],
      ["end", "service_over"],
      ["grant", null],
    ]);
  });

  it("the server refuses a grant from a service that isn't the current one", async () => {
    // Record this week's service, then grant only for next week's: at today's date that grant doesn't count.
    const now = new Date();
    await getCurrentService(env.DB, now, fake());
    await syncScheduledDirectors(env.DB, fake(), new Date(now.getTime() + 7 * DAY));
    expect((await grants()).filter((g) => g.ended_at === null)).toHaveLength(1);
    expect((await checklist(cookies.td)).service.reset).toBeUndefined();
    expect((await tryReset(cookies.td)).status).toBe(403);
  });

  it("loses it at the next check when they're taken off the plan, and the end is logged", async () => {
    expect((await me(cookies.td)).isDirector).toBe(true);
    await adjustSchedule({ unscheduledPeople: ["technical-director"] });
    await env.DB.prepare("DELETE FROM source_cache").run(); // as "Refresh" does; otherwise within 5 minutes
    expect((await me(cookies.td)).isDirector).toBe(false);
    expect((await tryReset(cookies.td)).status).toBe(403);
    expect((await roleLog()).at(-1)).toMatchObject({ target: "Test Technical Director", after: { scheduledDirector: null, reason: "not_scheduled" } });
  });

  it("loses it at the next check when the position stops granting it", async () => {
    expect((await me(cookies.td)).isDirector).toBe(true);
    await env.DB.prepare("UPDATE team_links SET grants_director = 0 WHERE position_external_id = ?").bind(TD).run();
    expect((await me(cookies.td)).isDirector).toBe(false);
    expect((await tryReset(cookies.td)).status).toBe(403);
    expect((await roleLog()).at(-1)?.after).toEqual({ scheduledDirector: null, reason: "not_scheduled" });
  });
});

describe("what never grants it", () => {
  it("a renamed position: people still carrying the old name match nothing (C38, C39)", async () => {
    // The sample schedule keeps the names people were scheduled under, as Planning Center does.
    await adjustSchedule({ renamedPositions: { [TD]: "Technical Director (Lead)" } });
    expect((await me(cookies.td)).isDirector).toBe(false);
    expect(await grants()).toEqual([]);
    expect(await roleLog()).toEqual([]);
  });

  it("Admin: an Admin scheduled in a marked position is never granted anything", async () => {
    await env.DB.prepare("UPDATE team_links SET grants_director = 1 WHERE position_external_id = 'pos-production-director'").run();
    const admin = await me(cookies.admin); // the test Admin is scheduled as Production Director
    expect(admin.scheduledDirector).toBeUndefined();
    expect(admin.isDirector).toBe(false);
    const adminId = await userIdOf("admin");
    expect((await grants()).some((g) => g.user_id === adminId)).toBe(false);
    // Only Director is ever written: no grant row or log entry touches Admin.
    expect((await roleLog()).every((e) => !("isAdmin" in e.after))).toBe(true);
  });

  it("leaves permanent Directors as they are", async () => {
    const before = await me(cookies.director);
    await me(cookies.td); // a check runs
    const after = await me(cookies.director);
    expect(before.isDirector).toBe(true);
    expect(after.isDirector).toBe(true);
    expect(after.scheduledDirector).toBeUndefined();
    expect(await env.DB.prepare("SELECT is_director FROM users WHERE id = ?").bind(await userIdOf("director")).first("is_director")).toBe(1);
  });
});

describe("outages", () => {
  it("keep the grant from the last successful check for that service, and grant nothing new", async () => {
    expect((await me(cookies.td)).isDirector).toBe(true);
    await adjustSchedule({ down: true });
    await env.DB.prepare("DELETE FROM source_cache").run();
    expect(await syncScheduledDirectors(env.DB, fake(), new Date())).toBe("unavailable");
    expect((await me(cookies.td)).isDirector).toBe(true);
    expect((await tryReset(cookies.td)).status).not.toBe(403);

    // Marking another position while down grants nothing until the source answers again.
    await env.DB.prepare("UPDATE team_links SET grants_director = 1 WHERE position_external_id = 'pos-production-director'").run();
    await env.DB.prepare("UPDATE team_links SET grants_director = 0 WHERE position_external_id = ?").bind(TD).run();
    await me(cookies.td);
    expect((await grants()).filter((g) => g.ended_at === null)).toHaveLength(1); // still the TD's, unchanged
    expect((await me(cookies.td)).isDirector).toBe(true);
  });
});

describe("the switch in team mapping", () => {
  const put = (cookie: string, body: unknown) =>
    request("/api/admin/mapping/director", { method: "PUT", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify(body) });

  it("is Admin only, needs the position's own link, and is logged", async () => {
    const off = { teamExternalId: "team-production", positionExternalId: TD, grantsDirector: false };
    expect((await put(cookies.td, off)).status).toBe(403);
    expect((await put(cookies.volunteer, off)).status).toBe(403);
    const markerId = (await env.DB.prepare("SELECT COALESCE(MAX(id), 0) AS id FROM mapping_events").first<{ id: number }>())?.id ?? 0;
    expect((await put(cookies.admin, off)).status).toBe(204);
    expect((await put(cookies.admin, off)).status).toBe(204); // unchanged: nothing logged
    expect((await put(cookies.admin, { teamExternalId: "team-production", positionExternalId: "pos-camera-1", grantsDirector: true })).status).toBe(409);
    expect((await put(cookies.admin, { teamExternalId: "team-production", positionExternalId: "pos-nope", grantsDirector: true })).status).toBe(404);
    const { results } = await env.DB.prepare("SELECT action, target_name, before_json, after_json FROM mapping_events WHERE id > ?").bind(markerId).all();
    expect(results).toEqual([
      { action: "director", target_name: "Production › Technical Director", before_json: '{"grantsDirector":true}', after_json: '{"grantsDirector":false}' },
    ]);
    expect(await env.DB.prepare("SELECT grants_director FROM team_links WHERE position_external_id = ?").bind(TD).first("grants_director")).toBe(0);
  });
});

// The real Planning Center path: the source matches the position name on the plan to the team's positions (C38).
// Declined people are left out, and a name that matches no position (a rename) grants nothing.
describe("with Planning Center's schedule", () => {
  const people = { scheduled: "pc-42", declined: "pc-43", oldName: "pc-44" };
  let ids: Record<keyof typeof people, number>;

  beforeAll(async () => {
    ids = {} as typeof ids;
    for (const [key, subject] of Object.entries(people)) {
      const user = await env.DB.prepare("INSERT INTO users (display_name) VALUES (?) RETURNING id").bind(`PC ${key}`).first<{ id: number }>();
      await env.DB.prepare("INSERT INTO user_identities (user_id, provider, subject) VALUES (?, 'planning_center', ?)").bind(user?.id, subject).run();
      ids[key as keyof typeof people] = user?.id as number;
    }
  });
  afterAll(async () => {
    // Back to the shared setup: the fake source's Service Type, and no plan recorded from this test.
    await env.DB.batch([
      env.DB.prepare("UPDATE settings SET value = 'fake' WHERE key = 'schedule_source'"),
      env.DB.prepare("UPDATE settings SET value = 'st-sunday' WHERE key = 'schedule_service_type'"),
      env.DB.prepare("UPDATE services SET plan_source = NULL, plan_external_id = NULL WHERE plan_source = 'planning_center'"),
      env.DB.prepare("DELETE FROM team_links WHERE source = 'planning_center'"),
      env.DB.prepare("DELETE FROM source_cache"),
    ]);
  });

  it("grants only the person scheduled under the position's current name, not declined, not an old name", async () => {
    const now = new Date();
    const serviceDay = (await getCurrentService(env.DB, now, null))?.date as string;
    await env.DB.batch([
      env.DB.prepare("UPDATE settings SET value = 'planning_center' WHERE key = 'schedule_source'"),
      env.DB.prepare("UPDATE settings SET value = '111' WHERE key = 'schedule_service_type'"),
      env.DB.prepare(
        `INSERT INTO team_links (source, team_external_id, position_external_id, category_id, team_name, position_name, grants_director)
         VALUES ('planning_center', 't1', 'p2', ${DEPARTMENT}, 'Media Team', 'Technical Director', 1)`,
      ),
    ]);
    const member = (id: string, person: string, status: string, positionName: string) => ({
      type: "PlanPerson",
      id,
      attributes: { status, team_position_name: positionName },
      relationships: { person: { data: { type: "Person", id: person } }, team: { data: { type: "Team", id: "t1" } } },
    });
    const answers: Record<string, unknown> = {
      "/services/v2/service_types/111/plans": { data: [{ type: "Plan", id: "pl1", attributes: { sort_date: `${serviceDay}T16:00:00Z` } }] },
      "/services/v2/service_types/111/teams": {
        data: [{ type: "Team", id: "t1", attributes: { name: "Media Team" }, relationships: { team_positions: { data: [{ type: "TeamPosition", id: "p1" }, { type: "TeamPosition", id: "p2" }] } } }],
        included: [
          { type: "TeamPosition", id: "p1", attributes: { name: "Audio" }, relationships: { team: { data: { type: "Team", id: "t1" } } } },
          { type: "TeamPosition", id: "p2", attributes: { name: "Technical Director" }, relationships: { team: { data: { type: "Team", id: "t1" } } } },
        ],
      },
      "/services/v2/service_types/111/plans/pl1/team_members": {
        data: [
          member("m1", people.scheduled, "C", " technical director "), // matched by name, ignoring capitals and spaces
          member("m2", people.declined, "D", "Technical Director"), // declined
          member("m3", people.oldName, "C", "TD"), // the position's old name: matches nothing
        ],
      },
    };
    const fetchImpl = async (url: string) => {
      const body = answers[new URL(url).pathname];
      return body
        ? new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } })
        : new Response(JSON.stringify({ errors: [{ status: "404" }] }), { status: 404 });
    };
    await env.DB.prepare("DELETE FROM source_cache").run();
    const source = createPlanningCenterSchedule(env.DB, { appId: "a", secret: "b" }, fetchImpl);

    expect(await syncScheduledDirectors(env.DB, source, now)).toBe("synced");
    expect((await grants()).map((g) => [g.user_id, g.position_name])).toEqual([[ids.scheduled, "Media Team › Technical Director"]]);
    expect(await activeDirectorGrant(env.DB, ids.declined, now)).toBeNull();
    expect(await activeDirectorGrant(env.DB, ids.oldName, now)).toBeNull();
    expect((await roleLog()).map((e) => [e.target, e.user])).toEqual([["PC scheduled", "Planning Center schedule"]]);
  });
});
