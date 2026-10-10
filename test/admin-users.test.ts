// Stage 6: Admins grant and revoke Admin and Director (US-03). Admin only; takes effect on the person's next
// request; never removes the last Admin; every change logged, append-only, in the same transaction.
import { env } from "cloudflare:test";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ApiErrorBody, ChecklistResponse, MeResponse, RoleEditsResponse, UpdateRolesResponse, UsersResponse } from "../src/shared/types";
import { request, signInAs, userIdOf, withCookie } from "./helpers";

const KEYS = ["admin", "director", "volunteer", "outsider"] as const;
const cookies: Record<(typeof KEYS)[number], string> = { admin: "", director: "", volunteer: "", outsider: "" };
const ids: Record<(typeof KEYS)[number], number> = { admin: 0, director: 0, volunteer: 0, outsider: 0 };

beforeAll(async () => {
  for (const k of KEYS) {
    cookies[k] = await signInAs(k);
    ids[k] = await userIdOf(k);
  }
});

let marker: number;
beforeEach(async () => {
  marker = (await env.DB.prepare("SELECT COALESCE(MAX(id), 0) AS id FROM role_events").first<{ id: number }>())?.id ?? 0;
});

// Back to the test users' starting roles (the log keeps its rows: it's append-only).
afterEach(async () => {
  await env.DB.batch(
    KEYS.map((k) =>
      env.DB.prepare("UPDATE users SET is_admin = ?2, is_director = ?3 WHERE id = ?1").bind(ids[k], k === "admin" ? 1 : 0, k === "director" ? 1 : 0),
    ),
  );
});

const call = (cookie: string, method: string, path = "", body?: unknown) =>
  request(`/api/admin/users${path}`, {
    method,
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const setRoles = (who: (typeof KEYS)[number], roles: { isAdmin: boolean; isDirector: boolean }, as = cookies.admin) =>
  call(as, "PUT", `/${ids[who]}/roles`, roles);
const me = async (cookie: string) => (await (await request("/api/auth/me", withCookie(cookie))).json<MeResponse>()).user;
/** This test's role log entries, oldest first. */
const events = async () =>
  ((await (await call(cookies.admin, "GET", "/events")).json()) as RoleEditsResponse).events.filter((e) => e.id > marker).reverse();

describe("access", () => {
  it("is Admin only, on every endpoint", async () => {
    const body = { isAdmin: false, isDirector: true };
    for (const [method, path] of [["GET", ""], ["PUT", `/${ids.volunteer}/roles`], ["GET", "/events"]] as const) {
      for (const k of ["director", "volunteer", "outsider"] as const) {
        expect((await call(cookies[k], method, path, method === "PUT" ? body : undefined)).status, `${method} ${path} as ${k}`).toBe(403);
      }
      expect((await request(`/api/admin/users${path}`, { method })).status, `${method} ${path} signed out`).toBe(401);
    }
    expect((await me(cookies.volunteer)).isDirector).toBe(false);
  });
});

describe("the list of people", () => {
  it("lists everyone who has signed in, with roles and media-team status, and no sign-in IDs", async () => {
    const res = await call(cookies.admin, "GET");
    const text = await res.text();
    const { users, timeZone } = JSON.parse(text) as UsersResponse;
    expect(timeZone).toBe("America/Winnipeg");
    const byId = new Map(users.map((u) => [u.id, u]));
    expect(byId.get(ids.admin)).toMatchObject({ name: "Test Admin", isAdmin: true, isDirector: false });
    expect(byId.get(ids.director)).toMatchObject({ isAdmin: false, isDirector: true });
    expect(byId.get(ids.volunteer)).toMatchObject({ isAdmin: false, isDirector: false, onMediaTeam: true });
    expect(byId.get(ids.outsider)).toMatchObject({ isAdmin: false, isDirector: false, onMediaTeam: false });
    // Never a provider or its ID (US-03a).
    expect(text).not.toMatch(/subject|provider|"dev"/);
  });
});

describe("granting and revoking (US-03)", () => {
  it("makes a Volunteer a Director, effective on their next request, and logs it", async () => {
    const res = await setRoles("volunteer", { isAdmin: false, isDirector: true });
    expect(res.status).toBe(200);
    expect(await res.json<UpdateRolesResponse>()).toEqual({ changed: ["isDirector"] });

    expect(await me(cookies.volunteer)).toMatchObject({ isDirector: true, hasAccess: true });
    // Directors get the reset details with the checklist (requirements v1.6).
    const checklist = await (await request("/api/checklist", withCookie(cookies.volunteer))).json<ChecklistResponse>();
    expect("reset" in checklist.service).toBe(true);

    expect(await events()).toEqual([
      expect.objectContaining({ target: "Test Volunteer", before: { isDirector: false }, after: { isDirector: true }, user: "Test Admin" }),
    ]);
  });

  it("revokes a Director, effective on their next request", async () => {
    expect((await setRoles("director", { isAdmin: false, isDirector: false })).status).toBe(200);
    // The test Director isn't on a media team, so without the role they have no access at all (US-02).
    expect(await me(cookies.director)).toMatchObject({ isDirector: false, hasAccess: false });
    expect((await request("/api/checklist", withCookie(cookies.director))).status).toBe(403);
    expect((await request(`/api/services/1/reset`, { method: "POST", ...withCookie(cookies.director) })).status).toBe(403);
  });

  it("gives someone outside the media team access by giving them a role (US-02)", async () => {
    expect((await me(cookies.outsider)).hasAccess).toBe(false);
    expect((await setRoles("outsider", { isAdmin: false, isDirector: true })).status).toBe(200);
    expect((await me(cookies.outsider)).hasAccess).toBe(true);
  });

  it("makes someone an Admin, who can then manage roles", async () => {
    expect((await setRoles("director", { isAdmin: true, isDirector: true })).status).toBe(200);
    expect((await call(cookies.director, "GET")).status).toBe(200);
    expect(await events()).toEqual([expect.objectContaining({ before: { isAdmin: false }, after: { isAdmin: true } })]);
  });

  it("changes and logs nothing when the roles are already set", async () => {
    const res = await setRoles("director", { isAdmin: false, isDirector: true });
    expect(await res.json<UpdateRolesResponse>()).toEqual({ changed: [] });
    expect(await events()).toEqual([]);
  });
});

describe("never without an Admin", () => {
  it("refuses to remove the last Admin, and logs nothing", async () => {
    const admins = (await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE is_admin = 1").first<{ n: number }>())?.n;
    expect(admins).toBe(1);
    const res = await setRoles("admin", { isAdmin: false, isDirector: false });
    expect(res.status).toBe(409);
    expect(await res.json<ApiErrorBody>()).toEqual({
      error: "You can't remove the last Admin. Make someone else an Admin first.",
      code: "last_admin",
    });
    expect((await me(cookies.admin)).isAdmin).toBe(true);
    expect(await events()).toEqual([]);
  });

  it("refuses it even when only Director changes alongside, keeping both roles as they were", async () => {
    const res = await setRoles("admin", { isAdmin: false, isDirector: true });
    expect(res.status).toBe(409);
    expect(await me(cookies.admin)).toMatchObject({ isAdmin: true, isDirector: false });
  });

  const adminCount = async () => (await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE is_admin = 1").first<{ n: number }>())?.n;

  it("lets only one of two Admins removing each other at the same time succeed", async () => {
    expect((await setRoles("director", { isAdmin: true, isDirector: true })).status).toBe(200);
    expect(await adminCount()).toBe(2);
    marker = (await env.DB.prepare("SELECT MAX(id) AS id FROM role_events").first<{ id: number }>())?.id ?? 0;

    const results = await Promise.all([
      setRoles("director", { isAdmin: false, isDirector: true }, cookies.admin),
      setRoles("admin", { isAdmin: false, isDirector: false }, cookies.director),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await (results.find((r) => r.status === 409) as Response).json<ApiErrorBody>()).toMatchObject({ code: "last_admin" });
    expect(await adminCount()).toBe(1);
    expect(await events()).toHaveLength(1); // the refused change logged nothing
  });

  it("lets only one of two Admins stepping down at the same time succeed", async () => {
    expect((await setRoles("director", { isAdmin: true, isDirector: true })).status).toBe(200);
    const results = await Promise.all([
      setRoles("admin", { isAdmin: false, isDirector: false }, cookies.admin),
      setRoles("director", { isAdmin: false, isDirector: true }, cookies.director),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await adminCount()).toBe(1);
  });

  it("is enforced by the database too, whatever makes the change (migration 0009)", async () => {
    await expect(env.DB.prepare("UPDATE users SET is_admin = 0 WHERE id = ?").bind(ids.admin).run()).rejects.toThrow(/at least one Admin/);
    await expect(env.DB.prepare("UPDATE users SET is_admin = 0").run()).rejects.toThrow(/at least one Admin/);
    expect(await adminCount()).toBe(1);
    // With another Admin in place, it's allowed.
    await env.DB.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").bind(ids.director).run();
    await env.DB.prepare("UPDATE users SET is_admin = 0 WHERE id = ?").bind(ids.admin).run();
    expect(await adminCount()).toBe(1);
  });

  it("lets an Admin step down once there's another Admin; they lose access to admin at once", async () => {
    expect((await setRoles("director", { isAdmin: true, isDirector: true })).status).toBe(200);
    expect((await setRoles("admin", { isAdmin: false, isDirector: false })).status).toBe(200);
    expect((await call(cookies.admin, "GET")).status).toBe(403);
    // The new Admin can't be removed now: they're the last one.
    expect((await setRoles("director", { isAdmin: false, isDirector: true }, cookies.director)).status).toBe(409);
  });
});

describe("bad requests", () => {
  it("needs both roles as true or false, and a real person", async () => {
    for (const body of [{}, { isAdmin: true }, { isAdmin: "yes", isDirector: false }, null]) {
      expect((await call(cookies.admin, "PUT", `/${ids.volunteer}/roles`, body)).status, JSON.stringify(body)).toBe(400);
    }
    expect((await call(cookies.admin, "PUT", "/999999/roles", { isAdmin: false, isDirector: true })).status).toBe(404);
    expect((await call(cookies.admin, "PUT", "/abc/roles", { isAdmin: false, isDirector: true })).status).toBe(400);
  });
});

describe("the role log", () => {
  it("is append-only", async () => {
    await setRoles("volunteer", { isAdmin: false, isDirector: true });
    await expect(env.DB.prepare("UPDATE role_events SET user_name = 'x' WHERE id > ?").bind(marker).run()).rejects.toThrow(/append-only/);
    await expect(env.DB.prepare("DELETE FROM role_events WHERE id > ?").bind(marker).run()).rejects.toThrow(/append-only/);
  });
});
