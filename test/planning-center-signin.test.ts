// Stage 9c: signing in with Planning Center (US-01, US-04b, US-03a). The provider against a fake Planning Center, then
// the two routes end to end: a fresh `state` that must come back, the code exchanged in the Worker, the person's token
// never stored, cancelled and unreachable sign-ins landing on the sign-in screen with a reason, and the same account
// linking as any sign-in (roles never from Planning Center).
import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { signInWithIdentity } from "../src/worker/db/users";
import { ProviderUnavailableError } from "../src/worker/sources/identity";
import { SignInDeclinedError, SignInFailedError, createPlanningCenterSignIn } from "../src/worker/sources/planning-center/identity";
import { BASE, request, sessionCookieFrom } from "./helpers";

const CREDENTIALS = { clientId: "client-123", clientSecret: "secret-456" };
const CONFIGURED = { PCO_CLIENT_ID: CREDENTIALS.clientId, PCO_CLIENT_SECRET: CREDENTIALS.clientSecret } as Partial<Env>;
const CALLBACK = `${BASE}/api/auth/planning-center/callback`;
const FAKE_PERSON_ACCESS = "person-access-token-xyz";
const ME = { data: { type: "Person", id: "98765", attributes: { name: "Pat Example", avatar: "https://avatars.example/pat.png" } } };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** A fake Planning Center for the token exchange and /people/v2/me; records what it was sent. */
function fakeOAuth({ token = json({ access_token: FAKE_PERSON_ACCESS, token_type: "bearer" }), me = json(ME) }: { token?: Response | Error; me?: Response } = {}) {
  const sent: { url: string; method: string; body: string | null; authorization: string | null }[] = [];
  const impl = async (url: string, init: RequestInit) => {
    sent.push({ url, method: init.method ?? "GET", body: typeof init.body === "string" ? init.body : null, authorization: new Headers(init.headers).get("Authorization") });
    if (url.endsWith("/oauth/token")) {
      if (token instanceof Error) throw token;
      return token.clone();
    }
    if (url.endsWith("/people/v2/me")) return me.clone();
    return json({}, 404);
  };
  return { impl, sent };
}

afterEach(() => vi.restoreAllMocks());

describe("the Planning Center sign-in provider", () => {
  it("sends people to Planning Center's consent page asking only for People, with our state and callback", () => {
    const url = new URL(createPlanningCenterSignIn(CREDENTIALS).authorizeUrl(CALLBACK, "state-abc"));
    expect(url.origin + url.pathname).toBe("https://api.planningcenteronline.com/oauth/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "client-123",
      redirect_uri: CALLBACK,
      response_type: "code",
      scope: "people",
      state: "state-abc",
    });
    expect(url.toString()).not.toContain("secret-456"); // the secret never goes to the browser
  });

  it("exchanges the code in the Worker with the secret, asks who signed in, and returns them (not the token)", async () => {
    const { impl, sent } = fakeOAuth();
    const identity = await createPlanningCenterSignIn(CREDENTIALS, impl).completeSignIn(new URL(`${CALLBACK}?code=code-1&state=s`), CALLBACK);
    expect(identity).toEqual({ provider: "planning_center", subject: "98765", name: "Pat Example", avatarUrl: "https://avatars.example/pat.png", email: null });
    expect(JSON.stringify(identity)).not.toContain(FAKE_PERSON_ACCESS);
    const [exchange, me] = sent;
    expect(exchange.method).toBe("POST");
    expect(Object.fromEntries(new URLSearchParams(exchange.body ?? ""))).toEqual({
      grant_type: "authorization_code",
      code: "code-1",
      client_id: "client-123",
      client_secret: "secret-456",
      redirect_uri: CALLBACK,
    });
    expect(me).toMatchObject({ method: "GET", authorization: `Bearer ${FAKE_PERSON_ACCESS}` });
  });

  it("joins first and last name when Planning Center gives no full name", async () => {
    const { impl } = fakeOAuth({ me: json({ data: { id: "1", attributes: { first_name: "Sam", last_name: "Lee", avatar: "" } } }) });
    const identity = await createPlanningCenterSignIn(CREDENTIALS, impl).completeSignIn(new URL(`${CALLBACK}?code=c`), CALLBACK);
    expect(identity).toMatchObject({ name: "Sam Lee", avatarUrl: null });
  });

  it("tells apart a cancelled sign-in, a refused code and Planning Center being down (US-04b)", async () => {
    const declined = createPlanningCenterSignIn(CREDENTIALS, fakeOAuth().impl).completeSignIn(new URL(`${CALLBACK}?error=access_denied`), CALLBACK);
    await expect(declined).rejects.toBeInstanceOf(SignInDeclinedError);
    const refused = createPlanningCenterSignIn(CREDENTIALS, fakeOAuth({ token: json({ error: "invalid_grant" }, 400) }).impl);
    await expect(refused.completeSignIn(new URL(`${CALLBACK}?code=old`), CALLBACK)).rejects.toBeInstanceOf(SignInFailedError);
    for (const token of [json({}, 503), new TypeError("network down")]) {
      const down = createPlanningCenterSignIn(CREDENTIALS, fakeOAuth({ token }).impl);
      await expect(down.completeSignIn(new URL(`${CALLBACK}?code=c`), CALLBACK)).rejects.toBeInstanceOf(ProviderUnavailableError);
    }
  });
});

describe("the sign-in routes", () => {
  const start = async () => {
    const res = await request("/api/auth/planning-center/start", { redirect: "manual" }, CONFIGURED);
    const state = new URL(res.headers.get("Location") ?? "").searchParams.get("state") ?? "";
    const cookie = res.headers.get("Set-Cookie") ?? "";
    return { res, state, cookie, stateCookie: cookie.split(";")[0] };
  };
  const callback = (query: string, cookie: string) =>
    request(`/api/auth/planning-center/callback?${query}`, { redirect: "manual", headers: cookie ? { Cookie: cookie } : {} }, CONFIGURED);

  it("says whether Planning Center sign-in is set up", async () => {
    expect(await (await request("/api/auth/sign-in-options")).json()).toEqual({ planningCenter: false });
    expect(await (await request("/api/auth/sign-in-options", {}, CONFIGURED)).json()).toEqual({ planningCenter: true });
  });

  it("start: sends the browser to Planning Center with a fresh state kept in a short-lived HttpOnly cookie", async () => {
    const { res, state, cookie } = await start();
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get("Location") ?? "");
    expect(location.origin).toBe("https://api.planningcenteronline.com");
    expect(location.searchParams.get("redirect_uri")).toBe(CALLBACK);
    expect(state.length).toBeGreaterThanOrEqual(40);
    expect(cookie).toContain(`pco_signin_state=${state}`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth\/planning-center/);
    expect(cookie).toMatch(/Max-Age=600/);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect((await start()).state).not.toBe(state); // a new one each time
  });

  it("start without the OAuth application set up goes back to the sign-in screen", async () => {
    const res = await request("/api/auth/planning-center/start", { redirect: "manual" });
    expect(res.headers.get("Location")).toBe("/?signin=not_set_up");
  });

  it("callback: refuses a state that doesn't match (or is missing), signing nobody in", async () => {
    const { stateCookie } = await start();
    for (const [query, cookie] of [["code=c&state=forged", stateCookie], ["code=c&state=x", ""], ["code=c", stateCookie]]) {
      const res = await callback(query, cookie);
      expect(res.headers.get("Location")).toBe("/?signin=failed");
      expect(sessionCookieFrom(res)).toBeNull();
    }
  });

  it("callback: signs the person in through account linking, keeps no token, and goes home", async () => {
    const { impl } = fakeOAuth();
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => impl(String(input instanceof Request ? input.url : input), init ?? {}));
    const { state, stateCookie } = await start();
    const res = await callback(`code=code-1&state=${state}`, stateCookie);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/");
    const session = sessionCookieFrom(res);
    expect(session).not.toBeNull();
    expect(res.headers.get("Set-Cookie")).toMatch(/pco_signin_state=;/); // the state is used up

    const link = await env.DB.prepare("SELECT user_id FROM user_identities WHERE provider = 'planning_center' AND subject = '98765'").first<{ user_id: number }>();
    expect(link).not.toBeNull();
    const user = await env.DB.prepare("SELECT display_name, is_admin, is_director FROM users WHERE id = ?").bind(link?.user_id).first();
    expect(user).toEqual({ display_name: "Pat Example", is_admin: 0, is_director: 0 }); // roles never come from Planning Center
    // The person's token is nowhere in the database.
    for (const table of ["users", "user_identities"]) {
      const { results } = await env.DB.prepare(`SELECT * FROM ${table}`).all();
      expect(JSON.stringify(results)).not.toContain(FAKE_PERSON_ACCESS);
    }
    // And the session works: they're signed in as that app user.
    const me = await (await request("/api/auth/me", { headers: { Cookie: session ?? "" } }, CONFIGURED)).json<{ user: { name: string } }>();
    expect(me.user.name).toBe("Pat Example");
  });

  it("callback: a cancelled sign-in, or Planning Center down, lands on the sign-in screen saying so", async () => {
    let { state, stateCookie } = await start();
    expect((await callback(`error=access_denied&state=${state}`, stateCookie)).headers.get("Location")).toBe("/?signin=cancelled");

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("network down"));
    ({ state, stateCookie } = await start());
    const res = await callback(`code=c&state=${state}`, stateCookie);
    expect(res.headers.get("Location")).toBe("/?signin=unavailable");
    expect(sessionCookieFrom(res)).toBeNull();
  });
});

describe("account linking for a real sign-in", () => {
  it("keeps the last team confirmation (onMediaTeam: null), so an outage at sign-in doesn't clear it (US-04a)", async () => {
    const identity = { provider: "planning_center" as const, subject: "keep-1", name: "Keep Me", avatarUrl: null, email: null };
    const id = await signInWithIdentity(env.DB, { identity, onMediaTeam: true }, "2026-10-01T10:00:00.000Z");
    await signInWithIdentity(env.DB, { identity, onMediaTeam: null }, "2026-10-05T10:00:00.000Z");
    const row = await env.DB.prepare("SELECT team_verified_at, last_seen_at FROM users WHERE id = ?").bind(id).first();
    expect(row).toEqual({ team_verified_at: "2026-10-01T10:00:00.000Z", last_seen_at: "2026-10-05T10:00:00.000Z" });
  });
});
