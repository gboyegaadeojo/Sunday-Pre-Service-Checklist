// Proves the fake sign-in cannot be reached in production, even with DEV_AUTH set.
// Runs against the real production bundle, which `npm test` builds first.
import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import bundleSource from "../dist/sunday_pre_service_checklist/index.js?raw";
import { FAKE_USERS } from "../src/worker/dev/fake-users";

const clientChunks = import.meta.glob<string>("../dist/client/assets/*.js", {
  query: "?raw",
  import: "default",
  eager: true,
});

// @ts-expect-error -- the built JS bundle has no type declarations; its shape is asserted below.
const worker = (await import("../dist/sunday_pre_service_checklist/index.js")) as {
  default: { fetch: (req: Request, env: Env, ctx: ExecutionContext) => Promise<Response> };
};

async function callProduction(path: string, init?: RequestInit) {
  const ctx = createExecutionContext();
  const res = await worker.default.fetch(new Request(`https://checklist.test${path}`, init), { ...env, DEV_AUTH: "true" }, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

describe("production build", () => {
  it("Worker bundle contains no fake sign-in code or test users", () => {
    expect(bundleSource).not.toContain("/api/dev");
    for (const u of FAKE_USERS) {
      expect(bundleSource).not.toContain(u.id);
      expect(bundleSource).not.toContain(u.name);
    }
  });

  it("client bundle has the single sign-in button and no developer sign-in", () => {
    const source = Object.values(clientChunks).join("\n");
    expect(Object.keys(clientChunks).length).toBeGreaterThan(0);
    expect(source).toContain("Sign in with Planning Center");
    expect(source).not.toContain("/api/dev");
    expect(source).not.toContain("Developer only");
  });

  it("returns 404 for every fake sign-in route even with DEV_AUTH=true", async () => {
    expect((await callProduction("/api/dev/users")).status).toBe(404);
    const signIn = await callProduction("/api/dev/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "admin" }),
    });
    expect(signIn.status).toBe(404);
    expect(signIn.headers.get("Set-Cookie")).toBeNull();
  });

  it("still serves the real API", async () => {
    const res = await callProduction("/api/auth/me");
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "signed_out" });
  });
});
