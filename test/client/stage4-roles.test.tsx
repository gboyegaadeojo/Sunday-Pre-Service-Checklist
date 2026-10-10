// Stage 4 role rules in the UI (requirements v1.6): progress for everyone with access, reset/undo for
// Admins and Directors, the activity log for Admins only. The server enforces the same rules
// (test/resets.test.ts); these tests make sure the UI never offers what the server would refuse.
import { cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChecklistResponse, CurrentUser, ResetInfo } from "../../src/shared/types";
import { AppNav } from "../../src/client/components/app/AppNav";
import { UserMenu } from "../../src/client/components/app/UserMenu";
import { useRoute } from "../../src/client/lib/router";
import { ProgressPage } from "../../src/client/pages/ProgressPage";

const user = (role: "volunteer" | "director" | "admin"): CurrentUser => ({
  id: ["volunteer", "director", "admin"].indexOf(role) + 1,
  name: `Test ${role}`,
  avatarUrl: null,
  isAdmin: role === "admin",
  isDirector: role === "director",
  hasAccess: true,
});

const RESET: ResetInfo = { id: 1, at: "2026-10-11T14:00:00.000Z", by: "Test director", archived: 3, undoneAt: null, undoneBy: null, canUndo: true };

function checklist(role: "volunteer" | "director" | "admin", reset: ResetInfo | null = null): ChecklistResponse {
  return {
    service: {
      id: 7,
      date: "2026-10-11",
      isToday: true,
      published: false,
      timeZone: "America/Winnipeg",
      ...(role === "volunteer" ? {} : { reset }), // the server sends reset details to staff only
    },
    list: { id: 1, name: "Test list" },
    view: { mode: "choose", own: [], note: null },
    categories: [
      {
        id: 1,
        name: "Department A",
        sections: [
          {
            id: 1,
            name: "Section",
            tasks: [
              { id: 1, text: "Task one", checkoff: { by: "Test volunteer", at: "2026-10-11T13:55:00.000Z" } },
              { id: 2, text: "Task two", checkoff: null },
            ],
          },
        ],
      },
      { id: 2, name: "Department B", sections: [] },
    ],
  };
}

let fetchMock: ReturnType<typeof vi.fn>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function serve(role: "volunteer" | "director" | "admin", reset: ResetInfo | null = null) {
  fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const path = String(input);
    if (path === "/api/checklist") return json(checklist(role, reset));
    if (path === "/api/services/7/reset" && init.method === "POST") return json({ reset: { ...RESET, archived: 1 }, affected: 1 });
    return json({ error: "Not found" }, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
}

beforeEach(() => {
  // happy-dom's <dialog> may lack showModal/close; give it the minimal behaviour the component uses.
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & { showModal?: () => void };
  if (!proto.showModal) proto.showModal = function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
  if (!proto.close) proto.close = function (this: HTMLDialogElement) { this.removeAttribute("open"); };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("header navigation", () => {
  // Administrative Settings is in an Admin's menu, not the header (requirements v1.20).
  it.each(["volunteer", "director", "admin"] as const)("shows the %s only Checklist and Progress", (role) => {
    render(<AppNav user={user(role)} route="checklist" onNavigate={() => {}} />);
    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual(["Checklist", "Progress"]);
  });
});

// The menu under the person's name (requirements v1.20): who they are, Administrative Settings for Admins only, then
// Sign out, set apart. A keyboard menu: focus moves in on opening, arrows move, Escape closes and returns focus.
describe("user menu", () => {
  const openMenu = (role: "volunteer" | "director" | "admin", onNavigate = vi.fn()) => {
    render(<UserMenu user={user(role)} route="checklist" onNavigate={onNavigate} onSignOut={() => {}} signingOut={false} signOutError={null} />);
    fireEvent.click(screen.getByRole("button", { name: `Account: Test ${role}` }));
    return onNavigate;
  };

  it.each(["volunteer", "director"] as const)("never offers Administrative Settings to a %s", (role) => {
    openMenu(role);
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText(`Test ${role}`)).toBeTruthy(); // who they are
    expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Sign out"]);
  });

  it("offers an Admin Administrative Settings above Sign out, and closes after choosing it", () => {
    const onNavigate = openMenu("admin");
    const [admin, signOut] = within(screen.getByRole("menu")).getAllByRole("menuitem");
    expect(admin.textContent).toBe("Administrative Settings");
    expect(admin.getAttribute("href")).toBe("/admin");
    expect(signOut.textContent).toBe("Sign out");
    fireEvent.click(admin);
    expect(onNavigate).toHaveBeenCalledWith("admin-overview", "");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("works from the keyboard: focus moves in, arrows wrap, Escape closes and returns focus", async () => {
    openMenu("admin");
    const [admin, signOut] = within(screen.getByRole("menu")).getAllByRole("menuitem");
    await waitFor(() => expect(document.activeElement).toBe(admin));
    fireEvent.keyDown(admin, { key: "ArrowDown" });
    expect(document.activeElement).toBe(signOut);
    fireEvent.keyDown(signOut, { key: "ArrowDown" });
    expect(document.activeElement).toBe(admin);
    fireEvent.keyDown(admin, { key: "End" });
    expect(document.activeElement).toBe(signOut);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Account: Test admin" }));
  });
});

describe("old addresses", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("redirects /settings to Church settings in Administrative Settings", () => {
    window.history.replaceState(null, "", "/settings");
    const { result } = renderHook(() => useRoute());
    expect(result.current.route).toBe("admin-settings");
    expect(window.location.pathname).toBe("/admin/settings");
  });
});

describe("progress page", () => {
  it("shows a Volunteer the full dashboard but no reset controls", async () => {
    serve("volunteer");
    render(<ProgressPage user={user("volunteer")} onAccessChanged={() => {}} />);
    await screen.findByText("Department A");
    // Three figures: tasks completed of the total, departments in progress, departments not started.
    const summary = screen.getByRole("region", { name: "Overall progress" });
    expect([...summary.querySelectorAll("dt")].map((d) => d.textContent)).toEqual(["Completed", "In progress", "Not started"]);
    expect(summary.textContent).toMatch(/Completed\s*1\s*of 2 tasks/);
    expect(screen.getByRole("button", { name: /Department A/ }).textContent).toContain("1 of 2 tasks completed");
    // Explicit status labels, not colour alone.
    expect(screen.getByRole("button", { name: /Department A/ }).textContent).toContain("In progress");
    expect(screen.getByRole("button", { name: /Department B/ }).textContent).toContain("No tasks");
    expect(screen.queryByRole("button", { name: "Reset checklist" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Undo reset" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Department A/ }));
    expect(screen.getByText(/Test volunteer ·/)).toBeTruthy(); // who checked it, and when
    // Open tasks have no visible "Not done" line any more (design review #6); screen readers still hear it.
    expect(screen.getByText("Not done:")).toBeTruthy();
    expect(screen.queryByText("Not done")).toBeNull();
  });

  it("gives a Director reset and, after a reset, undo", async () => {
    serve("director", RESET);
    render(<ProgressPage user={user("director")} onAccessChanged={() => {}} />);
    await screen.findByText("Department A");
    expect(screen.getByRole("button", { name: "Reset checklist" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Undo reset" })).toBeTruthy();
  });

  it("confirms before resetting, with the required wording, then reports the result", async () => {
    serve("admin");
    render(<ProgressPage user={user("admin")} onAccessChanged={() => {}} />);
    await screen.findByText("Department A");

    fireEvent.click(screen.getByRole("button", { name: "Reset checklist" }));
    const dialog = screen.getByRole("dialog", { name: "Reset this checklist?", hidden: true });
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(within(dialog).getByText("This will clear all check-offs for this service. Are you sure?")).toBeTruthy();
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "POST")).toBe(false);

    fireEvent.click(within(dialog).getByRole("button", { name: "Reset checklist", hidden: true }));
    await waitFor(() => expect(screen.getByText("Checklist reset. 1 check-off cleared.")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith("/api/services/7/reset", expect.objectContaining({ method: "POST" }));
  });
});
