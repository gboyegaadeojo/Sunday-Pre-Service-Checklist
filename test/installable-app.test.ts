// Installable app (Stage 13, requirements C42): the manifest is named from Church settings (never from code), the app
// icons are the ones an Admin made from the logo mark (only while they show the current short name) or the neutral
// icon, and only Admins can upload icons, which must be PNGs for the current short name.
import { env } from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { APP_ICONS, type AppIconName, type SettingsResponse } from "../src/shared/types";
import { NEUTRAL_ICON_PNG } from "../src/worker/lib/neutral-icons";
import { request, signInAs } from "./helpers";

const cookies = { admin: "", volunteer: "" };
beforeAll(async () => {
  cookies.admin = await signInAs("admin");
  cookies.volunteer = await signInAs("volunteer");
});

const setting = (key: string, value: string | null) =>
  value === null
    ? env.DB.prepare("DELETE FROM settings WHERE key = ?").bind(key).run()
    : env.DB.prepare("INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT (key) DO UPDATE SET value = excluded.value").bind(key, value).run();
afterEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM app_icons"),
    env.DB.prepare("DELETE FROM settings WHERE key = 'home_screen_name'"),
    env.DB.prepare("UPDATE settings SET value = 'IFC' WHERE key = 'church_short_name'"),
    env.DB.prepare("UPDATE settings SET value = 'Pre-Service Checklist' WHERE key = 'app_name'"),
  ]);
});

const manifest = async () => {
  const res = await request("/manifest.webmanifest");
  expect(res.headers.get("Content-Type")).toBe("application/manifest+json");
  return (await res.json()) as Record<string, unknown> & { icons: { src: string; sizes: string; purpose: string }[] };
};
/** A tiny valid PNG (the neutral 192px icon) standing in for an icon drawn in the browser. */
const PNG_B64 = NEUTRAL_ICON_PNG[192];
const upload = (cookie: string, shortName: string, icons: Partial<Record<AppIconName, string>> = Object.fromEntries(APP_ICONS.map((n) => [n, PNG_B64]))) =>
  request("/api/admin/settings/app-icons", {
    method: "PUT",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ shortName, icons }),
  });

describe("the manifest", () => {
  it("is public, opens full screen, and is named from Church settings", async () => {
    const m = await manifest();
    expect(m).toMatchObject({
      id: "/",
      name: "IFC Pre-Service Checklist",
      short_name: "IFC", // no home screen name yet: the short name
      start_url: "/",
      display: "standalone",
    });
    expect(m.icons.map((i) => [i.sizes, i.purpose])).toEqual([
      ["192x192", "any"],
      ["512x512", "any"],
      ["512x512", "maskable"],
    ]);
  });

  it("uses the Home screen name for the label under the icon", async () => {
    await setting("home_screen_name", "IFC Checklist");
    expect(await manifest()).toMatchObject({ name: "IFC Pre-Service Checklist", short_name: "IFC Checklist" });
  });

  it("leaves out what isn't set, never filling it in from code", async () => {
    await setting("church_short_name", "");
    await setting("app_name", "");
    const m = await manifest();
    expect("name" in m).toBe(false);
    expect("short_name" in m).toBe(false);
  });
});

describe("the icons", () => {
  it("are the neutral purple icon until an Admin makes them from the logo mark", async () => {
    for (const file of ["icon-192.png", "icon-512.png", "maskable-512.png", "apple-touch-icon.png"]) {
      const res = await request(`/app-icons/${file}`);
      expect(res.status, file).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/png");
      expect([...new Uint8Array(await res.arrayBuffer()).slice(0, 4)]).toEqual([137, 80, 78, 71]);
    }
    expect((await request("/app-icons/other.png")).status).toBe(404);
  });

  it("serves the Admin's icons for the current short name, with their date in the manifest's addresses", async () => {
    const drawn = btoa(String.fromCharCode(...new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3])));
    expect((await upload(cookies.admin, "IFC", { ...Object.fromEntries(APP_ICONS.map((n) => [n, PNG_B64])), "icon-192": drawn })).status).toBe(204);
    const bytes = [...new Uint8Array(await (await request("/app-icons/icon-192.png")).arrayBuffer())];
    expect(bytes).toEqual([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
    expect((await manifest()).icons[0].src).toMatch(/^\/app-icons\/icon-192\.png\?v=\d+$/);
    const status = (await (await request("/api/admin/settings", { headers: { Cookie: cookies.admin } })).json()) as SettingsResponse;
    expect(status.appIcons).toMatchObject({ shortName: "IFC", updatedAt: expect.any(String) });

    // A new short name: the old icons no longer count, so the neutral icon is served until new ones are made.
    await setting("church_short_name", "NEW");
    expect((await request("/app-icons/icon-192.png")).headers.get("Content-Type")).toBe("image/png");
    expect([...new Uint8Array(await (await request("/app-icons/icon-192.png")).arrayBuffer())].length).toBeGreaterThan(11);
    expect((await manifest()).icons[0].src).toBe("/app-icons/icon-192.png");
  });

  it("can only be uploaded by an Admin, as PNGs, for the current short name", async () => {
    expect((await upload(cookies.volunteer, "IFC")).status).toBe(403);
    expect((await upload(cookies.admin, "OLD")).status).toBe(409); // a stale tab's short name
    expect((await upload(cookies.admin, "IFC", { "icon-192": PNG_B64 })).status).toBe(400); // missing icons
    expect((await upload(cookies.admin, "IFC", Object.fromEntries(APP_ICONS.map((n) => [n, btoa("not a png")])))).status).toBe(400);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM app_icons").first("n")).toBe(0);
  });
});

describe("the Home screen name setting", () => {
  it("is saved and logged like the other settings, and kept short", async () => {
    const put = (homeScreenName: string) =>
      request("/api/admin/settings", {
        method: "PUT",
        headers: { Cookie: cookies.admin, "Content-Type": "application/json" },
        body: JSON.stringify({ timeZone: "America/Winnipeg", serviceWeekday: 0, shortName: "IFC", teamName: "IFC Production", appName: "Pre-Service Checklist", homeScreenName }),
      });
    expect((await put("x".repeat(21))).status).toBe(400);
    const res = await put("  IFC Checklist ");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ changed: ["homeScreenName"] });
    expect(await env.DB.prepare("SELECT value FROM settings WHERE key = 'home_screen_name'").first("value")).toBe("IFC Checklist");
  });
});
