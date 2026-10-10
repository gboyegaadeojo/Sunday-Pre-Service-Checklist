// Stage 5d.3 service history page (design.md §7): the list of past services links to each one, which shows
// what was checked under its recorded department and section, the resets, and the activity log. Read-only.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivityResponse, HistoryResponse, ServiceHistoryResponse } from "../../src/shared/types";
import { HistoryPage } from "../../src/client/pages/admin/HistoryPage";

const SUMMARY = { id: 5, date: "2026-10-04", list: { id: 1, name: "Regular", hidden: false }, checkedCount: 2, resetCount: 1 };
let list: HistoryResponse;
const record: ServiceHistoryResponse = {
  service: { ...SUMMARY, timeZone: "America/Winnipeg", isCurrent: false },
  categories: [
    {
      id: 1,
      name: "Old department name",
      sections: [{ id: 2, name: "Power", tasks: [{ taskId: 9, text: "Text as it was", by: "Test Volunteer", at: "2026-10-04T14:00:00.000Z" }] }],
    },
  ],
  resets: [{ id: 3, at: "2026-10-04T13:00:00.000Z", by: "Test Director", archived: 4, undoneAt: null, undoneBy: null }],
};
const log: ActivityResponse = {
  service: { id: 5, date: "2026-10-04", timeZone: "America/Winnipeg" },
  events: [
    { id: 8, at: "2026-10-04T14:00:00.000Z", action: "check", outcome: "applied", taskId: 9, taskText: "Text as it was", affected: null, user: "Test Volunteer", sessionId: "s1", tabId: "t1" },
  ],
  truncated: false,
};

let paths: string[];
beforeEach(() => {
  list = { services: [SUMMARY], truncated: false };
  paths = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const path = String(input);
      paths.push(`${init.method ?? "GET"} ${path}`);
      const body = path === "/api/admin/history" ? list : path === "/api/admin/history/5" ? record : path === "/api/services/5/events" ? log : null;
      return new Response(JSON.stringify(body ?? { error: "Not found" }), { status: body ? 200 : 404, headers: { "Content-Type": "application/json" } });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("history page", () => {
  it("lists past services, each linking to its record", async () => {
    const onNavigate = vi.fn();
    render(<HistoryPage search="" onAccessChanged={() => {}} onNavigate={onNavigate} />);
    const link = await screen.findByRole("link", { name: /Sunday, October 4, 2026/ });
    expect(link.textContent).toContain("Regular");
    expect(link.textContent).toContain("2 tasks checked · reset once");
    expect(link.getAttribute("href")).toBe("/admin/history?service=5");
    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalledWith("admin-history", "?service=5");
  });

  it("says so when there are no past services", async () => {
    list = { services: [], truncated: false };
    render(<HistoryPage search="" onAccessChanged={() => {}} onNavigate={() => {}} />);
    await screen.findByText("No past services yet.");
  });

  it("shows one service as recorded, with its resets and log, and only reads", async () => {
    render(<HistoryPage search="?service=5" onAccessChanged={() => {}} onNavigate={() => {}} />);
    await screen.findByRole("heading", { name: "Sunday, October 4, 2026" });
    const checked = screen.getByRole("region", { name: "Checked tasks" });
    expect(within(checked).getByRole("heading", { name: "Old department name" })).toBeTruthy();
    expect(within(checked).getByRole("heading", { name: "Power" })).toBeTruthy();
    expect(within(checked).getByText("Text as it was")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Resets" }).textContent).toContain("Test Director");
    expect(screen.getByRole("region", { name: "Resets" }).textContent).toContain("4 check-offs cleared");
    expect(within(screen.getByRole("region", { name: "Activity log" })).getByText("Checked")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toEqual([]);
    expect(paths.every((p) => p.startsWith("GET "))).toBe(true);
  });

  it("offers a way back when a service can't be loaded", async () => {
    render(<HistoryPage search="?service=6" onAccessChanged={() => {}} onNavigate={() => {}} />);
    await screen.findByText("Couldn't load this service");
    expect(screen.getByRole("link", { name: "← All services" }).getAttribute("href")).toBe("/admin/history");
  });
});
