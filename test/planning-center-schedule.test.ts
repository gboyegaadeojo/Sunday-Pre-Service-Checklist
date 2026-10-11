// Stage 9b: the Planning Center schedule source, against Planning Center-shaped responses (JSON:API) from a fake fetch.
// It reads only (GET), sends the token only to Planning Center, follows pages, turns outages into
// ProviderUnavailableError (US-04a) and "not found" into none, and gives plan dates in the church's time zone.
import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { ProviderUnavailableError } from "../src/worker/sources/identity";
import { API_BASE } from "../src/worker/sources/planning-center/client";
import { createPlanningCenterSchedule, planningCenterSchedule } from "../src/worker/sources/planning-center/schedule";

type Route = (url: URL) => { status?: number; body?: unknown } | undefined;

/** A fake Planning Center: answers by path (and records every request). */
function fakePlanningCenter(route: Route) {
  const calls: { url: string; method: string; authorization: string | null }[] = [];
  const fetchImpl = async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method ?? "GET", authorization: new Headers(init.headers).get("Authorization") });
    const answer = route(new URL(url));
    if (!answer) return new Response(JSON.stringify({ errors: [{ status: "404" }] }), { status: 404 });
    return new Response(JSON.stringify(answer.body ?? {}), { status: answer.status ?? 200, headers: { "Content-Type": "application/json" } });
  };
  const source = createPlanningCenterSchedule(env.DB, { appId: "app-id", secret: "s3cret" }, fetchImpl);
  return { source, calls };
}

const team = (id: string, name: string, positionIds: string[], extra: Record<string, unknown> = {}) => ({
  type: "Team",
  id,
  attributes: { name, archived_at: null, ...extra },
  relationships: { team_positions: { data: positionIds.map((p) => ({ type: "TeamPosition", id: p })) } },
});
const position = (id: string, name: string, teamId: string) => ({
  type: "TeamPosition",
  id,
  attributes: { name },
  relationships: { team: { data: { type: "Team", id: teamId } } },
});
const TEAMS_PATH = "/services/v2/service_types/111/teams";

describe("reading the schedule", () => {
  it("lists live Service Types only", async () => {
    const { source } = fakePlanningCenter((u) =>
      u.pathname === "/services/v2/service_types"
        ? {
            body: {
              data: [
                { type: "ServiceType", id: "111", attributes: { name: "Sunday Service", archived_at: null } },
                { type: "ServiceType", id: "222", attributes: { name: "Old Service", archived_at: "2024-01-01T00:00:00Z" } },
              ],
            },
          }
        : undefined,
    );
    expect(await source.listServiceTypes()).toEqual([{ externalId: "111", name: "Sunday Service" }]);
  });

  it("lists a Service Type's live teams with their positions, following pages, but never off Planning Center", async () => {
    const { source, calls } = fakePlanningCenter((u) => {
      if (u.pathname !== TEAMS_PATH) return undefined;
      if (u.searchParams.get("offset") === "100") {
        return { body: { data: [team("t2", "Worship Band", [])], links: { next: "https://evil.example/steal" } } };
      }
      return {
        body: {
          data: [team("t1", "Production", ["p1", "p2"]), team("t9", "Archived team", [], { archived_at: "2025-01-01T00:00:00Z" })],
          included: [position("p1", "Audio", "t1"), position("p2", "Camera 2", "t1")],
          links: { next: `${API_BASE}${TEAMS_PATH}?per_page=100&include=team_positions&offset=100` },
        },
      };
    });
    expect(await source.listTeams("111")).toEqual([
      { externalId: "t1", name: "Production", positions: [{ externalId: "p1", name: "Audio" }, { externalId: "p2", name: "Camera 2" }] },
      { externalId: "t2", name: "Worship Band", positions: [] },
    ]);
    expect(calls.every((c) => c.url.startsWith(`${API_BASE}/`))).toBe(true); // the off-site "next" wasn't followed
    expect(calls).toHaveLength(2);
  });

  it("finds a person's teams from their roster positions and the teams they lead (US-02)", async () => {
    const { source } = fakePlanningCenter((u) => {
      if (u.pathname === "/services/v2/people/42/person_team_position_assignments") {
        return {
          body: {
            data: [
              { type: "PersonTeamPositionAssignment", id: "a1", attributes: {}, relationships: { team_position: { data: { type: "TeamPosition", id: "p2" } } } },
            ],
            included: [position("p2", "Camera 2", "t1")],
          },
        };
      }
      if (u.pathname === "/services/v2/people/42/team_leaders") {
        return { body: { data: [{ type: "TeamLeader", id: "l1", attributes: {}, relationships: { team: { data: { type: "Team", id: "t5" } } } }] } };
      }
      return undefined;
    });
    expect((await source.teamsOf("42")).sort()).toEqual(["t1", "t5"]);
  });

  it("treats someone Planning Center Services doesn't know as on no team", async () => {
    const { source } = fakePlanningCenter(() => undefined); // 404 for everything
    expect(await source.teamsOf("404")).toEqual([]);
  });

  it("gives the earliest plan on or after a date, dated in the church's time zone (US-07)", async () => {
    const { source, calls } = fakePlanningCenter((u) =>
      u.pathname === "/services/v2/service_types/111/plans"
        ? {
            body: {
              data: [
                { type: "Plan", id: "pl0", attributes: { sort_date: "2026-10-10T16:00:00Z" } }, // Saturday: before fromDate
                { type: "Plan", id: "pl9", attributes: { sort_date: null } }, // no times yet
                // 2 AM UTC Monday is still Sunday evening in Winnipeg (the seeded time zone).
                { type: "Plan", id: "pl1", attributes: { sort_date: "2026-10-12T02:00:00Z" } },
              ],
            },
          }
        : undefined,
    );
    expect(await source.nextPlan("111", "2026-10-11")).toEqual({ externalId: "111:pl1", date: "2026-10-11" });
    const asked = new URL(calls[0].url);
    expect(asked.searchParams.get("filter")).toBe("after");
    expect(asked.searchParams.get("after")).toBe("2026-10-10"); // a day early: Planning Center's dates are UTC
    expect(asked.searchParams.get("order")).toBe("sort_date");
  });

  it("has no plan when none is published", async () => {
    const { source } = fakePlanningCenter((u) => (u.pathname.endsWith("/plans") ? { body: { data: [] } } : undefined));
    expect(await source.nextPlan("111", "2026-10-11")).toBeNull();
  });

  it("finds where a person is scheduled: team and position (matched by name in the team), not declined", async () => {
    const member = (id: string, personId: string, status: string, positionName: string) => ({
      type: "PlanPerson",
      id,
      attributes: { status, team_position_name: positionName },
      relationships: { person: { data: { type: "Person", id: personId } }, team: { data: { type: "Team", id: "t1" } } },
    });
    const { source } = fakePlanningCenter((u) => {
      if (u.pathname === "/services/v2/service_types/111/plans/pl1/team_members") {
        return {
          body: {
            data: [
              member("m1", "42", "C", " camera 2 "),
              member("m2", "42", "D", "Audio"), // declined
              member("m3", "7", "C", "Audio"), // someone else
              member("m4", "42", "U", "Renamed Position"), // unknown name: the whole team
            ],
          },
        };
      }
      if (u.pathname === TEAMS_PATH) return { body: { data: [team("t1", "Production", ["p1", "p2"])], included: [position("p1", "Audio", "t1"), position("p2", "Camera 2", "t1")] } };
      return undefined;
    });
    expect(await source.assignments("111:pl1", "42")).toEqual([
      { teamExternalId: "t1", positionExternalId: "p2" },
      { teamExternalId: "t1", positionExternalId: null },
    ]);
  });
});

describe("talking to Planning Center", () => {
  it("only ever reads (GET), with the token as HTTP Basic, and only to Planning Center", async () => {
    const { source, calls } = fakePlanningCenter((u) => ({ body: { data: u.pathname.endsWith("/teams") ? [team("t1", "Production", [])] : [] } }));
    await source.listServiceTypes();
    await source.listTeams("111");
    await source.teamsOf("42");
    await source.nextPlan("111", "2026-10-11");
    await source.assignments("111:pl1", "42");
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect(c.method).toBe("GET");
      expect(c.url.startsWith(`${API_BASE}/`)).toBe(true);
      expect(c.authorization).toBe(`Basic ${btoa("app-id:s3cret")}`);
    }
  });

  it.each([
    ["is unreachable", () => Promise.reject(new TypeError("network down"))],
    ["is down (500)", async () => new Response("", { status: 500 })],
    ["is busy (429)", async () => new Response("", { status: 429 })],
    ["refuses the token (401)", async () => new Response("", { status: 401 })],
  ])("counts as unavailable when Planning Center %s (US-04a)", async (_, answer) => {
    const source = createPlanningCenterSchedule(env.DB, { appId: "a", secret: "b" }, answer as () => Promise<Response>);
    await expect(source.listServiceTypes()).rejects.toBeInstanceOf(ProviderUnavailableError);
  });
});

describe("which schedule is used", () => {
  it("is Planning Center only when both halves of its token are set", () => {
    expect(planningCenterSchedule(env, env.DB)).toBeNull();
    const configured = { ...env, PCO_PAT_ID: "app", PCO_PAT_SECRET: "secret" } as unknown as Env;
    expect(planningCenterSchedule(configured, env.DB)).toMatchObject({ id: "planning_center", label: "Planning Center" });
  });
});
