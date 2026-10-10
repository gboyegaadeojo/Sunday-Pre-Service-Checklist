// Stage 7a: team mapping with the fake schedule source (US-15). Admin only. Links use the source's IDs, so renames
// don't break them; nothing is linked automatically; positions in media teams that lead to no department are
// listed for the Admin; "Refresh" fetches anew; links gone from the source are flagged; every change is logged.
// Uses the seed checklist's department names, as the build plan's expected mapping does.
import { env } from "cloudflare:test";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { MappingEditsResponse, MappingResponse, MappingStatusResponse, SetLinkRequest } from "../src/shared/types";
import { request, signInAs } from "./helpers";

const cookies = { admin: "", director: "", volunteer: "" };
beforeAll(async () => {
  cookies.admin = await signInAs("admin");
  cookies.director = await signInAs("director");
  cookies.volunteer = await signInAs("volunteer");
});

/** Nothing mapped and the fake schedule as shipped (the log keeps its rows: it's append-only). */
const unmap = () =>
  env.DB.batch([
    env.DB.prepare("DELETE FROM team_links"),
    env.DB.prepare("DELETE FROM non_media_teams"),
    env.DB.prepare("DELETE FROM settings WHERE key IN ('schedule_source', 'schedule_service_type')"),
    env.DB.prepare("DELETE FROM source_cache"),
    env.DB.prepare("DELETE FROM dev_state"),
  ]);

let marker: number;
beforeEach(async () => {
  await unmap();
  marker = (await env.DB.prepare("SELECT COALESCE(MAX(id), 0) AS id FROM mapping_events").first<{ id: number }>())?.id ?? 0;
});
// Start each test unmapped, with a fresh fake schedule (the log keeps its rows: it's append-only).
afterEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM team_links"),
    env.DB.prepare("DELETE FROM non_media_teams"),
    env.DB.prepare("DELETE FROM settings WHERE key IN ('schedule_source', 'schedule_service_type')"),
    env.DB.prepare("DELETE FROM source_cache"),
    env.DB.prepare("DELETE FROM dev_state"),
  ]);
});

const call = (cookie: string, method: string, path = "", body?: unknown) =>
  request(`/api/admin/mapping${path}`, {
    method,
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const mapping = async () => (await (await call(cookies.admin, "GET")).json()) as MappingResponse;
const refresh = async () => (await (await call(cookies.admin, "POST", "/refresh")).json()) as MappingResponse;
const status = async () => (await (await call(cookies.admin, "GET", "/status")).json()) as MappingStatusResponse;
const events = async () =>
  ((await (await call(cookies.admin, "GET", "/events")).json()) as MappingEditsResponse).events.filter((e) => e.id > marker).reverse();
const chooseSunday = async () => expect((await call(cookies.admin, "PUT", "/service-type", { externalId: "st-sunday" })).status).toBe(204);
/** Sets the fake schedule's adjustments (dev-only route), as if changed in Planning Center. */
const adjustSchedule = async (state: unknown) =>
  expect((await request("/api/dev/schedule", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(state) })).status).toBe(204);

/** The seed department's ID by name. */
const department = async (name: string) =>
  (await env.DB.prepare("SELECT id FROM categories WHERE list_id = 1 AND name = ? AND deleted_at IS NULL").bind(name).first<{ id: number }>())?.id as number;
const link = async (position: string | null, departmentName: string | null, seesAll = false, team = "team-production") => {
  const body: SetLinkRequest = {
    teamExternalId: team,
    positionExternalId: position,
    departmentId: departmentName === null ? null : await department(departmentName),
    seesAll,
  };
  return call(cookies.admin, "PUT", "/link", body);
};
const positions = (m: MappingResponse, team = "team-production") => m.teams.find((t) => t.externalId === team)?.positions ?? [];
/** "Position: Department (status)" for the Production team. */
const summary = (m: MappingResponse) =>
  positions(m).map((p) => `${p.name}: ${p.link?.department.name ?? "-"} (${p.status}${p.link?.seesAll ? ", sees all" : ""})`);

/** The build plan's expected mapping (requirements v1.7), entered by an Admin as in the app. */
const EXPECTED: [string, string][] = [
  ["pos-audio", "Audio Engineer"],
  ["pos-camera-1", "Camera Operators"],
  ["pos-camera-2", "Camera Operators"],
  ["pos-propresenter", "Presentation / Computer Graphics"],
  ["pos-production-director", "Director (Switcher)"],
  ["pos-miscellaneous", "Miscellaneous"],
  ["pos-technical-director", "Technical Director"],
];
const mapExpected = async () => {
  for (const [position, dept] of EXPECTED) expect((await link(position, dept, position === "pos-technical-director")).status, position).toBe(204);
};

describe("access", () => {
  it("is Admin only, on every endpoint", async () => {
    for (const [method, path, body] of [
      ["GET", ""],
      ["GET", "/status"],
      ["GET", "/events"],
      ["POST", "/refresh"],
      ["PUT", "/service-type", { externalId: "st-sunday" }],
      ["PUT", "/link", { teamExternalId: "team-production", positionExternalId: null, departmentId: 1, seesAll: false }],
      ["PUT", "/team-review", { teamExternalId: "team-worship-band", notMediaTeam: true }],
    ] as const) {
      expect((await call(cookies.director, method, path, body)).status, `${method} ${path} as Director`).toBe(403);
      expect((await call(cookies.volunteer, method, path, body)).status, `${method} ${path} as Volunteer`).toBe(403);
      expect((await request(`/api/admin/mapping${path}`, { method })).status, `${method} ${path} signed out`).toBe(401);
    }
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM team_links").first("n")).toBe(0);
  });
});

describe("setting up", () => {
  it("starts with nothing chosen and nothing linked", async () => {
    const m = await mapping();
    expect(m.source).toEqual({ label: "Planning Center (sample data)" });
    expect(m.serviceTypes.map((t) => t.name)).toEqual(["Sunday Service", "Special Events"]);
    expect(m).toMatchObject({ serviceTypeId: null, teams: [], missing: [], unlinked: [], list: { id: 1 } });
    expect(m.departments.map((d) => d.name)).toContain("Technical Director");
    expect(await status()).toMatchObject({ unlinked: 0, missing: 0, newTeams: 0, ready: false, connected: true });
  });

  // The Admin home's "Needs attention" (design.md §7): set up or not, and an unreachable source as a finding, not a failure.
  it("reports whether team mapping is set up, and an unreachable source instead of failing", async () => {
    await chooseSunday();
    expect(await status()).toMatchObject({ ready: false }); // a Service Type, but nothing linked yet
    expect((await link(null, "Audio Engineer")).status).toBe(204);
    expect(await status()).toMatchObject({ ready: true });
    expect("unreachable" in (await status())).toBe(false);

    await adjustSchedule({ down: true });
    await env.DB.prepare("DELETE FROM source_cache").run();
    const res = await call(cookies.admin, "GET", "/status");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ unreachable: "Planning Center (sample data)", ready: true });
  });

  it("lists the chosen Service Type's teams and positions, none linked automatically", async () => {
    await chooseSunday();
    const m = await mapping();
    expect(m.serviceTypeId).toBe("st-sunday");
    expect(m.teams.map((t) => [t.name, t.isMediaTeam])).toEqual([
      ["Production", false],
      ["Worship Band", false],
    ]);
    expect(positions(m).every((p) => p.status === "unlinked" && p.link === null)).toBe(true);
    expect(m.fetchedAt).not.toBeNull();
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM team_links").first("n")).toBe(0);
    expect(await events()).toEqual([expect.objectContaining({ action: "service_type", target: "Sunday Service", before: { serviceType: null }, after: { serviceType: "Sunday Service" } })]);
  });

  it("takes the expected mapping, with Technical Director seeing all departments", async () => {
    await chooseSunday();
    await mapExpected();
    const m = await mapping();
    expect(summary(m)).toEqual([
      "Audio: Audio Engineer (linked)",
      "Camera 1: Camera Operators (linked)",
      "Camera 2: Camera Operators (linked)",
      "Propresenter: Presentation / Computer Graphics (linked)",
      "Production Director: Director (Switcher) (linked)",
      "Miscellaneous: Miscellaneous (linked)",
      "Technical Director: Technical Director (linked, sees all)",
    ]);
    expect(m.teams.map((t) => t.isMediaTeam)).toEqual([true, false]); // the band isn't a media team
    expect(m.unlinked).toEqual([]);
    expect((await events()).filter((e) => e.action === "link")).toHaveLength(7);
    // Stored by the source's IDs, never by name.
    const stored = await env.DB.prepare("SELECT source, team_external_id, position_external_id FROM team_links ORDER BY id LIMIT 1").first();
    expect(stored).toEqual({ source: "fake", team_external_id: "team-production", position_external_id: "pos-audio" });
  });
});

describe("unlinked positions (the Admin's notice)", () => {
  it("lists positions in a media team that lead to no department", async () => {
    await chooseSunday();
    expect((await link("pos-audio", "Audio Engineer")).status).toBe(204);
    const m = await mapping();
    expect(m.unlinked.map((u) => u.position)).toEqual(["Camera 1", "Camera 2", "Propresenter", "Production Director", "Miscellaneous", "Technical Director"]);
    expect(await status()).toMatchObject({ unlinked: 6, missing: 0 });
  });

  it("shows a position added in the source after setup as unlinked, once refreshed", async () => {
    await chooseSunday();
    await mapExpected();
    expect(await status()).toMatchObject({ unlinked: 0, missing: 0 });

    await adjustSchedule({ addedPositions: [{ teamExternalId: "team-production", externalId: "pos-camera-3", name: "Camera 3" }] });
    // Still the cached schedule until it expires or an Admin refreshes…
    expect(positions(await mapping()).map((p) => p.name)).not.toContain("Camera 3");
    // …and "Refresh from Planning Center" shows it straight away.
    const m = await refresh();
    expect(positions(m).find((p) => p.name === "Camera 3")).toMatchObject({ externalId: "pos-camera-3", status: "unlinked", link: null });
    expect(m.unlinked).toEqual([{ team: "Production", position: "Camera 3" }]);
    expect(await status()).toMatchObject({ unlinked: 1, missing: 0 });

    expect((await link("pos-camera-3", "Camera Operators")).status).toBe(204);
    expect(await status()).toMatchObject({ unlinked: 0, missing: 0 });
  });

  it("counts a position as linked when its team is linked", async () => {
    await chooseSunday();
    expect((await link(null, "Miscellaneous")).status).toBe(204);
    expect((await link("pos-audio", "Audio Engineer")).status).toBe(204);
    const m = await mapping();
    expect(summary(m).slice(0, 2)).toEqual(["Audio: Audio Engineer (linked)", "Camera 1: - (team)"]);
    expect(m.teams[0].link?.department.name).toBe("Miscellaneous");
    expect(m.unlinked).toEqual([]);
  });
});

describe("changes in the source", () => {
  it("keeps a link when the position is renamed (links use IDs)", async () => {
    await chooseSunday();
    expect((await link("pos-camera-2", "Camera Operators")).status).toBe(204);
    await adjustSchedule({ renamedPositions: { "pos-camera-2": "Camera 2 (Balcony)" } });
    const m = await refresh();
    expect(positions(m).find((p) => p.externalId === "pos-camera-2")).toMatchObject({ name: "Camera 2 (Balcony)", status: "linked" });
    expect(m.missing).toEqual([]);
  });

  it("flags a link whose position was deleted in the source, and lets the Admin remove it", async () => {
    await chooseSunday();
    expect((await link("pos-camera-2", "Camera Operators")).status).toBe(204);
    await adjustSchedule({ removedPositions: ["pos-camera-2"] });
    const m = await refresh();
    expect(m.missing).toEqual([
      { teamExternalId: "team-production", positionExternalId: "pos-camera-2", teamName: "Production", positionName: "Camera 2", department: expect.objectContaining({ name: "Camera Operators" }) },
    ]);
    expect(await status()).toMatchObject({ missing: 1 });

    expect((await link("pos-camera-2", null)).status).toBe(204);
    expect((await mapping()).missing).toEqual([]);
    expect((await events()).at(-1)).toMatchObject({ action: "unlink", target: "Production › Camera 2", after: null });
  });
});

describe("editing links", () => {
  it("changes, marks and removes a link, logging each", async () => {
    await chooseSunday();
    expect((await link("pos-technical-director", "Technical Director")).status).toBe(204);
    expect((await link("pos-technical-director", "Technical Director", true)).status).toBe(204);
    expect((await link("pos-technical-director", "Director (Switcher)", true)).status).toBe(204);
    expect((await link("pos-technical-director", null)).status).toBe(204);
    expect((await link("pos-technical-director", null)).status).toBe(204); // already gone: nothing to log
    const log = (await events()).slice(1); // after the Service Type
    expect(log.map((e) => e.action)).toEqual(["link", "sees_all", "link", "unlink"]);
    expect(log[1]).toMatchObject({ target: "Production › Technical Director", before: { seesAll: false }, after: { seesAll: true } });
    expect(log[2].before?.department?.name).toBe("Technical Director");
    expect(log[2].after).toMatchObject({ department: { name: "Director (Switcher)" }, seesAll: true });
  });

  it("refuses departments outside the default list, unknown positions, and bad requests", async () => {
    await chooseSunday();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO task_lists (id, name) VALUES (88, 'Other list')"),
      env.DB.prepare("INSERT INTO categories (id, list_id, name, sort_order) VALUES (8801, 88, 'Elsewhere', 1)"),
    ]);
    const put = (body: unknown) => call(cookies.admin, "PUT", "/link", body);
    expect((await put({ teamExternalId: "team-production", positionExternalId: "pos-audio", departmentId: 8801, seesAll: false })).status).toBe(400);
    expect((await put({ teamExternalId: "team-production", positionExternalId: "pos-nope", departmentId: 1, seesAll: false })).status).toBe(404);
    expect((await put({ teamExternalId: "team-production", positionExternalId: "pos-audio" })).status).toBe(400);
    expect((await call(cookies.admin, "PUT", "/service-type", { externalId: "st-nope" })).status).toBe(400);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM team_links").first("n")).toBe(0);
    await env.DB.batch([env.DB.prepare("DELETE FROM categories WHERE id = 8801"), env.DB.prepare("DELETE FROM task_lists WHERE id = 88")]);
  });

  it("drops a department's links when it's hidden (US-12), so its positions show as unlinked", async () => {
    await chooseSunday();
    await mapExpected();
    const tdId = await department("Technical Director");
    expect((await request(`/api/admin/categories/${tdId}`, { method: "DELETE", headers: { Cookie: cookies.admin } })).status).toBe(204);
    expect((await mapping()).unlinked).toEqual([{ team: "Production", position: "Technical Director" }]);
    await env.DB.prepare("UPDATE categories SET deleted_at = NULL WHERE id = ?").bind(tdId).run();
  });
});

describe("new teams (requirements v1.18)", () => {
  const review = (team: string, notMediaTeam: boolean) => call(cookies.admin, "PUT", "/team-review", { teamExternalId: team, notMediaTeam });

  it("shows teams with no links as new until linked or marked “Not a media team”, logging the mark", async () => {
    await chooseSunday();
    expect((await mapping()).newTeams.map((t) => t.name)).toEqual(["Production", "Worship Band"]);
    await mapExpected();
    expect((await mapping()).newTeams.map((t) => t.name)).toEqual(["Worship Band"]);
    expect(await status()).toMatchObject({ unlinked: 0, missing: 0, newTeams: 1 });

    expect((await review("team-worship-band", true)).status).toBe(204);
    const m = await mapping();
    expect(m.newTeams).toEqual([]);
    expect(m.teams.find((t) => t.name === "Worship Band")).toMatchObject({ notMediaTeam: true, isMediaTeam: false });
    expect(await status()).toMatchObject({ unlinked: 0, missing: 0, newTeams: 0 });
    expect((await events()).at(-1)).toMatchObject({ action: "not_media", target: "Worship Band", before: { notMediaTeam: false }, after: { notMediaTeam: true } });

    // Set once: marking again changes and logs nothing; undo brings the note back.
    const logged = (await events()).length;
    expect((await review("team-worship-band", true)).status).toBe(204);
    expect(await events()).toHaveLength(logged);
    expect((await review("team-worship-band", false)).status).toBe(204);
    expect((await mapping()).newTeams.map((t) => t.name)).toEqual(["Worship Band"]);
  });

  it("shows a team added in the source after setup as new, once refreshed, without counting it as unlinked", async () => {
    await chooseSunday();
    await mapExpected();
    expect((await review("team-worship-band", true)).status).toBe(204);
    expect(await status()).toMatchObject({ unlinked: 0, missing: 0, newTeams: 0 });

    await adjustSchedule({
      addedTeams: [{ serviceTypeExternalId: "st-sunday", externalId: "team-lighting", name: "Lighting", positions: [{ externalId: "pos-lights", name: "Lights" }] }],
    });
    expect((await mapping()).newTeams).toEqual([]); // cached until refreshed
    const m = await refresh();
    expect(m.newTeams).toEqual([{ externalId: "team-lighting", name: "Lighting" }]);
    expect(m.teams.find((t) => t.name === "Lighting")).toMatchObject({ isMediaTeam: false, notMediaTeam: false });
    expect(m.unlinked).toEqual([]); // informational, not a missing link
    expect(await status()).toMatchObject({ unlinked: 0, missing: 0, newTeams: 1 });

    // Linking it makes it a media team, so it's no longer new.
    expect((await link("pos-lights", "Miscellaneous", false, "team-lighting")).status).toBe(204);
    expect(await status()).toMatchObject({ unlinked: 0, missing: 0, newTeams: 0 });
  });

  it("won't mark a team with links, or link a marked team", async () => {
    await chooseSunday();
    expect((await link("pos-audio", "Audio Engineer")).status).toBe(204);
    const marked = await review("team-production", true);
    expect(marked.status).toBe(409);
    expect(await marked.json()).toMatchObject({ error: expect.stringContaining("Remove its links first") });

    expect((await review("team-worship-band", true)).status).toBe(204);
    const linked = await link("pos-vocals", "Miscellaneous", false, "team-worship-band");
    expect(linked.status).toBe(409);
    expect(await linked.json()).toMatchObject({ error: expect.stringContaining("Not a media team") });
    expect((await link(null, "Miscellaneous", false, "team-worship-band")).status).toBe(409);
    expect((await review("team-nope", true)).status).toBe(404);
    expect((await call(cookies.admin, "PUT", "/team-review", { teamExternalId: "team-worship-band" })).status).toBe(400);
  });
});

describe("the mapping log", () => {
  it("is append-only", async () => {
    await chooseSunday();
    await expect(env.DB.prepare("UPDATE mapping_events SET user_name = 'x' WHERE id > ?").bind(marker).run()).rejects.toThrow(/append-only/);
    await expect(env.DB.prepare("DELETE FROM mapping_events WHERE id > ?").bind(marker).run()).rejects.toThrow(/append-only/);
  });
});
