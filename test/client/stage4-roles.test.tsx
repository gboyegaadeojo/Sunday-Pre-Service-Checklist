// Stage 4 role rules in the UI (requirements v1.6): progress for everyone with access, reset/undo for
// Admins and Directors, the activity log for Admins only. The server enforces the same rules
// (test/resets.test.ts); these tests make sure the UI never offers what the server would refuse.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChecklistResponse, CurrentUser, ResetInfo } from "../../src/shared/types";
import { AppNav } from "../../src/client/components/app/AppNav";
import { ProgressPage } from "../../src/client/pages/ProgressPage";

const user = (role: "volunteer" | "director" | "admin"): CurrentUser => ({
  id: `dev-${role}`,
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
  it.each([
    ["volunteer", ["Checklist", "Progress"]],
    ["director", ["Checklist", "Progress"]],
    ["admin", ["Checklist", "Progress", "Admin"]],
  ] as const)("shows the %s only the sections they may use", (role, labels) => {
    render(<AppNav user={user(role)} route="checklist" onNavigate={() => {}} />);
    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual(labels);
  });
});

describe("progress page", () => {
  it("shows a Volunteer the full dashboard but no reset controls", async () => {
    serve("volunteer");
    render(<ProgressPage user={user("volunteer")} onAccessChanged={() => {}} />);
    await screen.findByText("Department A");
    expect(screen.getByRole("region", { name: "Overall progress" }).textContent).toMatch(/1 of 2\s*tasks done/);
    expect(screen.getByRole("button", { name: /Department A/ }).textContent).toMatch(/1 of 2 · 50%/);
    // Explicit status labels, not colour alone.
    expect(screen.getByRole("button", { name: /Department A/ }).textContent).toContain("In progress");
    expect(screen.getByRole("button", { name: /Department B/ }).textContent).toContain("No tasks");
    expect(screen.queryByRole("button", { name: "Reset checklist" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Undo reset" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Department A/ }));
    expect(screen.getByText(/Test volunteer ·/)).toBeTruthy(); // who checked it, and when
    expect(screen.getByText("Not done")).toBeTruthy();
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
