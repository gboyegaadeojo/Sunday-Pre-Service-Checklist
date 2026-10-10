// Stage 7b department view on the checklist (US-05): a scheduled volunteer sees their own department, with "Show all
// departments"; someone choosing is told why and their pick is remembered for the day; Admins, Directors and "sees
// all" positions see everything with theirs first, marked "Yours". The server decides the view (test/department-view).
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChecklistResponse, ChecklistView, CurrentUser } from "../../src/shared/types";
import { ChecklistPage } from "../../src/client/pages/ChecklistPage";

const USER: CurrentUser = { id: 1, name: "Test Camera Operator", avatarUrl: null, isAdmin: false, isDirector: false, hasAccess: true };
const department = (id: number, name: string) => ({
  id,
  name,
  sections: [{ id: id * 10, name: `${name} setup`, tasks: [{ id: id * 100, text: `${name} task`, checkoff: null }] }],
});
let view: ChecklistView;
const body = (): ChecklistResponse => ({
  service: { id: 7, date: "2026-10-11", isToday: false, published: true, timeZone: "America/Winnipeg" },
  list: { id: 1, name: "Regular" },
  categories: [department(1, "Presentation"), department(2, "Audio"), department(3, "Cameras")],
  view,
});

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body()), { headers: { "Content-Type": "application/json" } })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderPage = async () => {
  render(<ChecklistPage user={USER} onAccessChanged={() => {}} />);
  await screen.findByRole("region", { name: "Service overview" });
};
/** Department names in the sidebar, in order. */
const listed = () =>
  within(screen.getAllByRole("navigation", { name: "Departments" })[0])
    .getAllByRole("button")
    // The name (with any "Yours" tag), without the count and the status read to screen readers.
    .map((b) => b.querySelector("span.leading-snug")?.textContent);
const heading = () => screen.getByRole("heading", { level: 1 }).textContent;

describe("department view", () => {
  it("shows a scheduled volunteer only their department, and all of them on request, remembered for the day", async () => {
    view = { mode: "own", own: [3], note: null };
    await renderPage();
    expect(listed()).toEqual(["Cameras"]);
    expect(heading()).toBe("Cameras");
    expect(screen.getByText("Your department:")).toBeTruthy();

    fireEvent.click(screen.getByRole("switch", { name: "Show all departments" }));
    expect(listed()).toEqual(["CamerasYours", "Presentation", "Audio"]);
    expect(screen.getByText("first, then the rest")).toBeTruthy();

    // Still on after a reload today, on this device.
    cleanup();
    await renderPage();
    expect(screen.getByRole("switch", { name: "Show all departments" }).getAttribute("aria-checked")).toBe("true");
    expect(listed()).toHaveLength(3);
  });

  it("lists every department for someone in two positions, theirs only until shown all", async () => {
    view = { mode: "own", own: [1, 2], note: null };
    await renderPage();
    expect(listed()).toEqual(["Presentation", "Audio"]);
    expect(screen.getByText("Presentation, Audio")).toBeTruthy();
  });

  it("tells someone not scheduled why they choose, and remembers their pick for the day", async () => {
    view = { mode: "choose", own: [], note: "not_scheduled" };
    await renderPage();
    expect(screen.getByRole("note").textContent).toBe("You're not on the schedule for this service, but you can still help. Choose your department.");
    expect(listed()).toEqual(["Presentation", "Audio", "Cameras"]);
    expect(screen.queryByRole("switch", { name: "Show all departments" })).toBeNull();

    fireEvent.click(within(screen.getAllByRole("navigation", { name: "Departments" })[0]).getByRole("button", { name: /Audio/ }));
    expect(heading()).toBe("Audio");
    cleanup();
    await renderPage();
    expect(heading()).toBe("Audio");
  });

  it("tells someone whose position isn't linked why they choose", async () => {
    view = { mode: "choose", own: [], note: "not_linked" };
    await renderPage();
    expect(screen.getByRole("note").textContent).toContain("Your position isn't linked to a checklist department yet");
  });

  it("shows everything to Admins, Directors and “sees all” positions, their own first and marked", async () => {
    view = { mode: "all", own: [3], note: null };
    await renderPage();
    expect(listed()).toEqual(["CamerasYours", "Presentation", "Audio"]);
    expect(heading()).toBe("Cameras");
    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("shows the checklist as before when the schedule can't say (no note, everything listed)", async () => {
    view = { mode: "choose", own: [], note: null };
    await renderPage();
    expect(listed()).toEqual(["Presentation", "Audio", "Cameras"]);
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("leads the overview with the volunteer's own progress while only theirs is shown", async () => {
    view = { mode: "own", own: [3], note: null };
    await renderPage();
    const overview = screen.getByRole("region", { name: "Service overview" });
    expect(within(overview).getByRole("progressbar", { name: "Your progress" }).getAttribute("aria-valuetext")).toBe("0 of 1 tasks done");
    expect(overview.textContent).toContain("Cameras: 0 of 1 done · 1 remaining");
    expect(overview.textContent).toContain("Whole service: 0 of 3 done · 3 remaining");

    // Showing all departments: back to the whole service's progress.
    fireEvent.click(screen.getByRole("switch", { name: "Show all departments" }));
    expect(within(overview).getByRole("progressbar", { name: "Overall progress" })).toBeTruthy();
    expect(overview.textContent).not.toContain("Whole service:");
  });

  it("keeps the whole service's progress for everyone else", async () => {
    for (const v of [
      { mode: "all", own: [3], note: null },
      { mode: "choose", own: [], note: "not_scheduled" },
    ] as ChecklistView[]) {
      view = v;
      await renderPage();
      const overview = screen.getByRole("region", { name: "Service overview" });
      expect(within(overview).getByRole("progressbar", { name: "Overall progress" })).toBeTruthy();
      expect(overview.textContent).toContain("0 of 3 tasks done");
      cleanup();
    }
  });

  it("during an outage, shows the banner and every department to pick from, without claiming nothing is published", async () => {
    view = { mode: "choose", own: [], note: "schedule_unavailable", source: "Planning Center" };
    const outage = body();
    outage.service.published = false; // the plan couldn't be looked up
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(outage), { headers: { "Content-Type": "application/json" } })));
    await renderPage();
    expect(screen.getByText("We couldn't load your schedule from Planning Center. Please select your department.")).toBeTruthy();
    expect(listed()).toEqual(["Presentation", "Audio", "Cameras"]);
    expect(screen.queryByText(/No service is published/)).toBeNull();
  });

  it("says when no service is published, and asks someone choosing to pick their department (US-05)", async () => {
    view = { mode: "choose", own: [], note: null, source: "Planning Center" };
    const unpublished = body();
    unpublished.service.published = false;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(unpublished), { headers: { "Content-Type": "application/json" } })));
    await renderPage();
    expect(
      screen.getByRole("note").textContent,
    ).toBe("No service is published in Planning Center yet — your checklist is ready when you are. Choose your department below.");
  });

  it("gives Admins and Directors the no-plan note without asking them to choose", async () => {
    view = { mode: "all", own: [], note: null, source: "Planning Center" };
    const unpublished = body();
    unpublished.service.published = false;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(unpublished), { headers: { "Content-Type": "application/json" } })));
    await renderPage();
    expect(screen.getByText("No service is published in Planning Center yet — your checklist is ready when you are.")).toBeTruthy();
    expect(screen.queryByText(/Choose your department below/)).toBeNull();
  });
});
