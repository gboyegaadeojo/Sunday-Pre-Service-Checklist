// Stage 8 design review fixes (docs/design-review.md), on the screens a volunteer uses on Sunday morning:
// #1 a failed save stays visible (the task says "Not saved", the message stays, the status stays in view),
// #4 a tap refused because the session ended says so on the sign-in screen,
// #5 Progress lists the person's own department first, marked "Yours", and #8 says why Reset is unavailable,
// #9 Admins and Directors are told while volunteers can't get in.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SetupNotice } from "../../src/client/components/app/SetupNotice";
import { SignInScreen } from "../../src/client/components/app/SignInScreen";
import { ChecklistPage } from "../../src/client/pages/ChecklistPage";
import { ProgressPage } from "../../src/client/pages/ProgressPage";
import type { ChecklistResponse, CurrentUser } from "../../src/shared/types";

const USER: CurrentUser = { id: 1, name: "Test Camera Operator", avatarUrl: null, isAdmin: false, isDirector: false, hasAccess: true };
const department = (id: number, name: string) => ({
  id,
  name,
  sections: [{ id: id * 10, name: `${name} setup`, tasks: [{ id: id * 100, text: `${name} task`, checkoff: null }] }],
});
const body = (): ChecklistResponse => ({
  service: { id: 7, date: "2026-10-11", isToday: false, published: true, timeZone: "America/Winnipeg", reset: null },
  list: { id: 1, name: "Regular" },
  categories: [department(1, "Presentation"), department(2, "Audio"), department(3, "Cameras")],
  view: { mode: "own", own: [3], note: null },
});
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

/** GET /api/checklist answers normally; check-offs answer with `checkoff()`. */
let checkoff: () => Response;
beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => (String(url).includes("/checkoff") && init?.method !== "GET" ? checkoff() : json(body()))),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const renderChecklist = async (onAccessChanged = vi.fn()) => {
  render(<ChecklistPage user={USER} onAccessChanged={onAccessChanged} />);
  await screen.findByRole("region", { name: "Service overview" });
  return onAccessChanged;
};
const task = () => screen.getByRole("checkbox", { name: /Cameras task/ });

describe("a failed save stays visible (#1)", () => {
  it("marks the task, keeps the message past the old 7 seconds, and clears both when the save works", async () => {
    checkoff = () => json({ error: "Something went wrong on the server." }, 500);
    await renderChecklist();
    fireEvent.click(task());

    await screen.findByText("Not saved. Tap to try again.");
    expect((task() as HTMLInputElement).checked).toBe(false); // reverted: never shown as saved
    expect(screen.getByRole("alert").textContent).toContain(`Couldn't save "Cameras task"`);
    // The short status in the sticky bar and the sidebar, as well as the overview's.
    expect(screen.getAllByText("Not saved").length).toBeGreaterThan(0);

    vi.useFakeTimers();
    await act(async () => vi.advanceTimersByTime(10_000));
    vi.useRealTimers();
    expect(screen.getByRole("alert")).toBeTruthy(); // still there

    checkoff = () => json({ checkoff: { by: USER.name, at: "2026-10-11T14:00:00.000Z" } });
    fireEvent.click(task());
    await waitFor(() => expect(screen.queryByText("Not saved. Tap to try again.")).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
    expect((task() as HTMLInputElement).checked).toBe(true);
    expect(screen.getAllByText("Saved").length).toBeGreaterThan(0);
  });
});

describe("signed out mid-save (#4)", () => {
  it("re-checks access saying a change was lost, and the sign-in screen explains", async () => {
    checkoff = () => json({ error: "Please sign in.", code: "signed_out" }, 401);
    const onAccessChanged = await renderChecklist();
    fireEvent.click(task());
    await waitFor(() => expect(onAccessChanged).toHaveBeenCalledWith("unsaved_change"));
    cleanup();

    render(<SignInScreen notice="You were signed out, so your last change wasn't saved. Sign in to carry on." />);
    expect(screen.getByRole("status").textContent).toBe("You were signed out, so your last change wasn't saved. Sign in to carry on.");
  });
});

describe("Progress (#5, #8)", () => {
  it("lists the person's own department first, marked Yours, and every other one after", async () => {
    render(<ProgressPage user={USER} onAccessChanged={() => {}} />);
    await screen.findByRole("region", { name: "Overall progress" });
    const names = screen.getAllByRole("button", { expanded: false }).map((b) => b.querySelector("span.font-semibold")?.textContent);
    expect(names).toEqual(["CamerasYours", "Presentation", "Audio"]);
  });

  it("says in words why Reset is unavailable while nothing is checked", async () => {
    render(<ProgressPage user={{ ...USER, isDirector: true }} onAccessChanged={() => {}} />);
    const reset = await screen.findByRole("region", { name: "Reset" });
    expect(within(reset).getByText("Nothing to reset yet: no tasks are checked.")).toBeTruthy();
    expect((within(reset).getByRole("button", { name: "Reset checklist" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("setup notice for Admins and Directors (#9)", () => {
  it("tells an Admin volunteers can't get in, with a link to team mapping", () => {
    const navigate = vi.fn();
    render(<SetupNotice isAdmin onNavigate={navigate} />);
    expect(screen.getByRole("status").textContent).toContain("Volunteers can't get in yet: team mapping isn't set up.");
    fireEvent.click(screen.getByRole("link", { name: "Set up team mapping" }));
    expect(navigate).toHaveBeenCalledWith("admin-mapping", "");
  });

  it("tells a Director who can fix it, with no link they couldn't use", () => {
    render(<SetupNotice isAdmin={false} onNavigate={() => {}} />);
    expect(screen.getByRole("status").textContent).toContain("An Admin can set it up under Admin › Team mapping.");
    expect(screen.queryByRole("link")).toBeNull();
  });
});
