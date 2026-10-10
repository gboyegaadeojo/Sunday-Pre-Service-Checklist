// Stage 6 Users page (US-03): Admin and Director switches per person, search, the only Admin protected, and a
// confirmation before an Admin removes their own Admin role. The server enforces the same (test/admin-users.test.ts).
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser, UserSummary, UsersResponse } from "../../src/shared/types";
import { UsersPage } from "../../src/client/pages/admin/UsersPage";

const person = (id: number, name: string, roles: Partial<UserSummary> = {}): UserSummary => ({
  id,
  name,
  avatarUrl: null,
  isAdmin: false,
  isDirector: false,
  onMediaTeam: true,
  lastSeenAt: "2026-10-04T15:00:00.000Z",
  ...roles,
});
const ME: CurrentUser = { id: 1, name: "Test Admin", avatarUrl: null, isAdmin: true, isDirector: false, hasAccess: true };

let data: UsersResponse;
let puts: { path: string; body: unknown }[];
let refuse: { status: number; error: string } | null;
const onAccessChanged = vi.fn();
const onNavigate = vi.fn();

beforeEach(() => {
  data = {
    timeZone: "America/Winnipeg",
    users: [
      person(1, "Test Admin", { isAdmin: true }),
      person(2, "Test Volunteer"),
      person(3, "Test Outsider", { onMediaTeam: false, lastSeenAt: null }),
    ],
  };
  puts = [];
  refuse = null;
  onAccessChanged.mockReset();
  onNavigate.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const path = String(input);
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
      if (init.method === "PUT") {
        if (refuse) return json({ error: refuse.error }, refuse.status);
        const body = JSON.parse(String(init.body));
        puts.push({ path, body });
        const id = Number(path.split("/")[4]);
        data = { ...data, users: data.users.map((u) => (u.id === id ? { ...u, ...body } : u)) };
        return json({ changed: [] });
      }
      return json(data);
    }),
  );
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & { showModal?: () => void };
  if (!proto.showModal) proto.showModal = function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
  if (!proto.close) proto.close = function (this: HTMLDialogElement) { this.removeAttribute("open"); };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderPage = async () => {
  render(<UsersPage me={ME} onAccessChanged={onAccessChanged} onNavigate={onNavigate} />);
  await screen.findByRole("heading", { name: "Users" });
};
const toggle = (role: "Admin" | "Director", name: string) => screen.getByRole("switch", { name: `${role}: ${name}` });

describe("users page", () => {
  it("lists people with what they can do, and their roles as switches", async () => {
    await renderPage();
    const rows = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(rows[0]).toContain("Test AdminYouAdmin · last seen Oct 4, 2026");
    expect(rows[1]).toContain("Volunteer · last seen");
    expect(rows[2]).toContain("No access: not on a media team · last seen never");
    expect(toggle("Admin", "Test Admin").getAttribute("aria-checked")).toBe("true");
    expect(toggle("Director", "Test Volunteer").getAttribute("aria-checked")).toBe("false");
  });

  it("makes someone a Director, server first", async () => {
    await renderPage();
    fireEvent.click(toggle("Director", "Test Volunteer"));
    await waitFor(() => expect(puts).toEqual([{ path: "/api/admin/users/2/roles", body: { isAdmin: false, isDirector: true } }]));
    await screen.findByText("Test Volunteer is now a Director.");
    expect(toggle("Director", "Test Volunteer").getAttribute("aria-checked")).toBe("true");
  });

  it("won't offer to remove the only Admin", async () => {
    await renderPage();
    expect((toggle("Admin", "Test Admin") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("The only Admin, so this role can't be removed.")).toBeTruthy();
  });

  it("asks before an Admin removes their own Admin role, even with other Admins, then leaves the admin area", async () => {
    // Two other Admins: stepping down is allowed, but still confirmed.
    data.users[1] = { ...data.users[1], isAdmin: true };
    data.users[2] = { ...data.users[2], isAdmin: true };
    await renderPage();
    expect((toggle("Admin", "Test Admin") as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(toggle("Admin", "Test Admin"));
    const dialog = screen.getByRole("dialog", { name: "Remove your own Admin role?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(puts).toEqual([]);

    fireEvent.click(toggle("Admin", "Test Admin"));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove my Admin role" }));
    await waitFor(() => expect(puts).toEqual([{ path: "/api/admin/users/1/roles", body: { isAdmin: false, isDirector: false } }]));
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith("checklist"));
    expect(onAccessChanged).toHaveBeenCalled();
  });

  it("doesn't ask before removing someone else's Admin role", async () => {
    data.users[1] = { ...data.users[1], isAdmin: true };
    await renderPage();
    fireEvent.click(toggle("Admin", "Test Volunteer"));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(puts).toEqual([{ path: "/api/admin/users/2/roles", body: { isAdmin: false, isDirector: false } }]));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("shows the server's reason when it refuses the last Admin's removal", async () => {
    // The page thought there were two Admins, but the other one was removed meanwhile.
    data.users[1] = { ...data.users[1], isAdmin: true };
    refuse = { status: 409, error: "You can't remove the last Admin. Make someone else an Admin first." };
    await renderPage();
    fireEvent.click(toggle("Admin", "Test Admin"));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove my Admin role" }));
    await screen.findByText("You can't remove the last Admin. Make someone else an Admin first.");
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("finds people by name", async () => {
    await renderPage();
    fireEvent.change(screen.getByLabelText("Search by name"), { target: { value: "outs" } });
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("Test Outsider");
    fireEvent.change(screen.getByLabelText("Search by name"), { target: { value: "nobody" } });
    expect(screen.getByText("No one named “nobody”.")).toBeTruthy();
  });
});
