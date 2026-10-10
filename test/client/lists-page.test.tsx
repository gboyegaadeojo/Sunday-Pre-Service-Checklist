// Stage 5d.1 Lists page (US-11): the default first, hiding only what the server allows, creating (empty or
// a copy) and going straight to the editor, and making a list the default (optionally for the current
// service, only while it has no check-offs).
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminListSummary, ListsResponse } from "../../src/shared/types";
import { ListsPage } from "../../src/client/pages/admin/ListsPage";

const list = (id: number, name: string, extra: Partial<AdminListSummary> = {}): AdminListSummary => ({
  id,
  name,
  description: null,
  isDefault: false,
  departmentCount: 6,
  taskCount: 120,
  createdAt: "2026-10-01T00:00:00Z",
  hiddenAt: null,
  ...extra,
});

let data: ListsResponse;
let calls: string[];
const navigate = vi.fn();

beforeEach(() => {
  data = {
    lists: [
      list(1, "Regular Sunday", { isDefault: true, description: "Every week" }),
      list(2, "Christmas Eve"),
      list(3, "Old list", { hiddenAt: "2026-09-01T00:00:00Z" }),
    ],
    currentService: { id: 9, date: "2026-10-11", listId: 1, hasCheckoffs: false },
    timeZone: "America/Winnipeg",
  };
  calls = [];
  navigate.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const path = String(input);
      const method = init.method ?? "GET";
      if (method === "GET") return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
      calls.push(`${method} ${path} ${init.body ?? ""}`.trim());
      if (method === "POST" && path === "/api/admin/lists") return new Response(JSON.stringify({ id: 42 }), { status: 201 });
      if (path.endsWith("/default")) return new Response(JSON.stringify({ serviceSwitched: true }), { status: 200 });
      return new Response(null, { status: 204 });
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
  render(<ListsPage onAccessChanged={() => {}} onNavigate={navigate} />);
  await screen.findByRole("heading", { name: "Regular Sunday" });
};
const menu = (name: string) => fireEvent.click(screen.getByRole("button", { name: `Actions for list: ${name}` }));

describe("Lists page", () => {
  it("shows the default and this service's list, and won't offer to hide them", async () => {
    await renderPage();
    expect(screen.getByText("Default")).toBeTruthy();
    expect(screen.getByText("This service")).toBeTruthy();
    menu("Regular Sunday");
    expect((screen.getByRole("button", { name: "Can't hide: default list" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Make default" })).toBeNull();
    // Hidden lists are listed separately, with Restore.
    fireEvent.click(screen.getByRole("button", { name: "Restore list: Old list" }));
    await waitFor(() => expect(calls).toEqual(["POST /api/admin/lists/3/restore"]));
  });

  it("creates a copy and goes straight to editing it", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "New list" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Easter" } });
    fireEvent.click(screen.getByRole("radio", { name: "A copy of" }));
    fireEvent.change(screen.getByLabelText("List to copy"), { target: { value: "2" } });
    expect(screen.getByText(/Hidden items and Planning Center links aren't copied/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create list" }));
    await waitFor(() => expect(calls).toEqual(['POST /api/admin/lists {"name":"Easter","description":null,"copyFrom":2}']));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("admin-checklist", "?list=42"));
  });

  it("makes a list the default, and can switch this service while it has no check-offs", async () => {
    await renderPage();
    menu("Christmas Eve");
    fireEvent.click(screen.getByRole("button", { name: "Make default" }));
    const dialog = screen.getByRole("dialog", { name: "Make “Christmas Eve” the default?", hidden: true });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Also use it for Sunday, October 11, 2026/, hidden: true }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Make default", hidden: true }));
    await waitFor(() => expect(calls).toEqual(['POST /api/admin/lists/2/default {"applyToCurrentService":true}']));
    await screen.findByText("“Christmas Eve” is now the default list. Sunday, October 11, 2026 uses it too.");
  });

  it("explains that a service with check-offs keeps its list", async () => {
    data.currentService = { id: 9, date: "2026-10-11", listId: 1, hasCheckoffs: true };
    await renderPage();
    menu("Christmas Eve");
    fireEvent.click(screen.getByRole("button", { name: "Make default" }));
    const dialog = screen.getByRole("dialog", { name: "Make “Christmas Eve” the default?", hidden: true });
    expect(within(dialog).queryByRole("checkbox", { hidden: true })).toBeNull();
    expect(dialog.textContent).toContain("already has check-offs, so it keeps “Regular Sunday”");
  });
});
