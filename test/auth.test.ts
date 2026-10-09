import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { MeResponse } from "../src/shared/types";
import { SESSION_TTL_SECONDS, createSessionToken, verifySessionToken } from "../src/worker/lib/session";
import { request, sessionCookieFrom, signInAs, withCookie } from "./helpers";

const now = () => Math.floor(Date.now() / 1000);

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM users").run();
});

describe("session tokens", () => {
  const secret = "unit-test-key";

  it("round-trips a valid token", async () => {
    const token = await createSessionToken(secret, "123", now());
    expect(await verifySessionToken(secret, token, now())).toMatchObject({ sub: "123" });
  });

  it("rejects a token signed with another key", async () => {
    const token = await createSessionToken("other-key", "123", now());
    expect(await verifySessionToken(secret, token, now())).toBeNull();
  });

  it("rejects a tampered payload", async () => {
    const token = await createSessionToken(secret, "123", now());
    const [, sig] = token.split(".");
    const forged = btoa(JSON.stringify({ sub: "999", iat: now(), exp: now() + 999 })).replace(/=+$/, "");
    expect(await verifySessionToken(secret, `${forged}.${sig}`, now())).toBeNull();
  });

  it("rejects an expired token and garbage", async () => {
    const old = now() - SESSION_TTL_SECONDS - 10;
    expect(await verifySessionToken(secret, await createSessionToken(secret, "123", old), now())).toBeNull();
    expect(await verifySessionToken(secret, "not-a-token", now())).toBeNull();
    expect(await verifySessionToken(secret, "a.b.c", now())).toBeNull();
  });
});

describe("dev sign-in (Stage 2)", () => {
  it("sets a 30-day HttpOnly, Secure, SameSite=Lax session cookie (US-01)", async () => {
    const res = await request("/api/dev/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "volunteer" }),
    });
    expect(res.status).toBe(204);
    const setCookie = res.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toMatch(/^session=/);
    expect(setCookie).toContain(`Max-Age=${SESSION_TTL_SECONDS}`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
  });

  it("rejects unknown test users", async () => {
    const res = await request("/api/dev/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "nobody" }),
    });
    expect(res.status).toBe(400);
  });

  it("does not exist unless DEV_AUTH is 'true'", async () => {
    for (const DEV_AUTH of ["", "false"]) {
      expect((await request("/api/dev/users", {}, { DEV_AUTH })).status).toBe(404);
      const signIn = await request(
        "/api/dev/sign-in",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"key":"admin"}' },
        { DEV_AUTH },
      );
      expect(signIn.status).toBe(404);
    }
  });

  it("keeps roles an admin changed when the user signs in again (US-03)", async () => {
    await signInAs("volunteer");
    await env.DB.prepare("UPDATE users SET is_director = 1 WHERE pco_person_id = 'dev-volunteer'").run();
    const cookie = await signInAs("volunteer");
    const { user } = await (await request("/api/auth/me", withCookie(cookie))).json<MeResponse>();
    expect(user.isDirector).toBe(true);
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 without a session", async () => {
    const res = await request("/api/auth/me");
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "signed_out" });
  });

  it.each([
    ["volunteer", { name: "Test Volunteer", isAdmin: false, isDirector: false, hasAccess: true }],
    ["admin", { name: "Test Admin", isAdmin: true, isDirector: false, hasAccess: true }],
    ["director", { name: "Test Director", isAdmin: false, isDirector: true, hasAccess: true }],
    ["outsider", { name: "Test Non-member", isAdmin: false, isDirector: false, hasAccess: false }],
  ])("describes the %s", async (key, expected) => {
    const res = await request("/api/auth/me", withCookie(await signInAs(key)));
    expect(res.status).toBe(200);
    expect((await res.json<MeResponse>()).user).toMatchObject(expected);
  });

  it("re-reads roles from the database on every request (US-03)", async () => {
    const cookie = await signInAs("admin");
    await env.DB.prepare("UPDATE users SET is_admin = 0 WHERE pco_person_id = 'dev-admin'").run();
    const { user } = await (await request("/api/auth/me", withCookie(cookie))).json<MeResponse>();
    expect(user.isAdmin).toBe(false);
  });

  it("treats a session for a deleted user as signed out and clears the cookie", async () => {
    const cookie = await signInAs("volunteer");
    await env.DB.prepare("DELETE FROM users").run();
    const res = await request("/api/auth/me", withCookie(cookie));
    expect(res.status).toBe(401);
    expect(res.headers.get("Set-Cookie")).toMatch(/^session=;.*Max-Age=0/);
  });

  it("clears a cookie with a bad signature", async () => {
    const res = await request("/api/auth/me", withCookie("session=forged.token"));
    expect(res.status).toBe(401);
    expect(res.headers.get("Set-Cookie")).toMatch(/^session=;.*Max-Age=0/);
  });

  it("renews the 30-day cookie once it is over an hour old", async () => {
    await signInAs("volunteer");
    const fresh = await request("/api/auth/me", withCookie(await signInAs("volunteer")));
    expect(sessionCookieFrom(fresh)).toBeNull();

    const oldToken = await createSessionToken(env.SESSION_SECRET, "dev-volunteer", now() - 2 * 60 * 60);
    const res = await request("/api/auth/me", withCookie(`session=${oldToken}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toContain(`Max-Age=${SESSION_TTL_SECONDS}`);
    expect(sessionCookieFrom(res)).not.toBe(`session=${oldToken}`);
  });
});

describe("POST /api/auth/sign-out", () => {
  it("clears the session cookie", async () => {
    const res = await request("/api/auth/sign-out", { method: "POST", ...withCookie(await signInAs("volunteer")) });
    expect(res.status).toBe(204);
    expect(res.headers.get("Set-Cookie")).toMatch(/session=;.*Max-Age=0/);
  });
});

describe("checklist access (US-02, US-17)", () => {
  it("requires a session", async () => {
    const res = await request("/api/checklist");
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "signed_out" });
  });

  it("refuses users who are not on a media team and have no role", async () => {
    const res = await request("/api/checklist", withCookie(await signInAs("outsider")));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      code: "no_access",
      error: "This app is for the media team. If you think you should have access, contact a media team admin.",
    });
  });

  it.each(["volunteer", "admin", "director"])("allows the %s", async (key) => {
    expect((await request("/api/checklist", withCookie(await signInAs(key)))).status).toBe(200);
  });

  it("lets a non-member in once an admin makes them a Director (US-02)", async () => {
    const cookie = await signInAs("outsider");
    await env.DB.prepare("UPDATE users SET is_director = 1 WHERE pco_person_id = 'dev-outsider'").run();
    expect((await request("/api/checklist", withCookie(cookie))).status).toBe(200);
  });
});
