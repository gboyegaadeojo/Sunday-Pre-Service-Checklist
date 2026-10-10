// Stage 9a: Planning Center settings and which schedule source is used. Production uses Planning Center when its
// token is set and never the fake (test/production-build.test.ts); locally the fake stays the default, and
// SCHEDULE_SOURCE=planning_center switches to the real one. Tests never see a developer's real values.
import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { MappingResponse } from "../src/shared/types";
import { planningCenterCredentials, wantsRealScheduleLocally } from "../src/worker/sources/planning-center/config";
import { request, signInAs, withCookie } from "./helpers";

const withEnv = (values: Record<string, string>) => ({ ...env, ...values }) as unknown as Env;

describe("Planning Center credentials", () => {
  it("are not set in tests, whatever a developer's .dev.vars holds", () => {
    expect(planningCenterCredentials(env)).toEqual({ schedule: null, signIn: null });
    expect(wantsRealScheduleLocally(env)).toBe(false);
  });

  it("need both halves of each pair, ignore blanks and trim spaces", () => {
    expect(planningCenterCredentials(withEnv({ PCO_PAT_ID: "app" }))).toEqual({ schedule: null, signIn: null });
    expect(planningCenterCredentials(withEnv({ PCO_PAT_ID: "app", PCO_PAT_SECRET: "   " })).schedule).toBeNull();
    expect(planningCenterCredentials(withEnv({ PCO_PAT_ID: " app ", PCO_PAT_SECRET: "s3cret" })).schedule).toEqual({ appId: "app", secret: "s3cret" });
    expect(planningCenterCredentials(withEnv({ PCO_CLIENT_ID: "client", PCO_CLIENT_SECRET: "shh" })).signIn).toEqual({ clientId: "client", clientSecret: "shh" });
  });

  it("SCHEDULE_SOURCE=planning_center is the only value that asks for the real schedule locally", () => {
    expect(wantsRealScheduleLocally(withEnv({ SCHEDULE_SOURCE: "planning_center" }))).toBe(true);
    expect(wantsRealScheduleLocally(withEnv({ SCHEDULE_SOURCE: " planning_center " }))).toBe(true);
    for (const v of ["", "fake", "pco", "Planning Center"]) expect(wantsRealScheduleLocally(withEnv({ SCHEDULE_SOURCE: v }))).toBe(false);
  });
});

describe("the schedule source in local development", () => {
  it("is the sample schedule by default", async () => {
    const admin = await signInAs("admin");
    const m = (await (await request("/api/admin/mapping", withCookie(admin))).json()) as MappingResponse;
    expect(m.source).toEqual({ label: "Planning Center (sample data)" });
  });

  it("switches away from the sample with SCHEDULE_SOURCE=planning_center (Planning Center itself arrives in 9b)", async () => {
    const admin = await signInAs("admin");
    const m = (await (await request("/api/admin/mapping", withCookie(admin), { SCHEDULE_SOURCE: "planning_center" } as Partial<Env>)).json()) as MappingResponse;
    expect(m.source).toBeNull();
  });
});
