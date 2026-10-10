// Service history page (Stage 5d.3, design.md §7; US-07b): the list of past services links to each one. A service
// with a record shows "X of Y done" overall and per department, unchecked tasks, and tasks removed during it; an
// older one shows only what was checked. Resets and the activity log too. Read-only.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivityResponse, HistoryResponse, ServiceHistoryResponse } from "../../src/shared/types";
import { HistoryPage } from "../../src/client/pages/admin/HistoryPage";

const SUMMARY = { id: 5, date: "2026-10-04", list: { id: 1, name: "Regular", hidden: false }, checkedCount: 1, totalCount: 2, resetCount: 1 };
const CHECKED = { by: "Test Volunteer", at: "2026-10-04T14:00:00.000Z" };
let list: HistoryResponse;
let record: ServiceHistoryResponse;
const log: ActivityResponse = {
  service: { id: 5, date: "2026-10-04", timeZone: "America/Winnipeg" },
  events: [
    { id: 8, at: "2026-10-04T14:00:00.000Z", action: "check", outcome: "applied", taskId: 9, taskText: "Old wording", affected: null, user: "Test Volunteer", sessionId: "s1", tabId: "t1" },
  ],
  truncated: false,
};

let paths: string[];
beforeEach(() => {
  list = { services: [SUMMARY, { ...SUMMARY, id: 4, date: "2026-09-27", checkedCount: 3, totalCount: null, resetCount: 0 }], truncated: false };
  record = {
    service: { ...SUMMARY, timeZone: "America/Winnipeg", isCurrent: false, record: { from: "2026-09-28T05:00:00.000Z", partial: false } },
    categories: [
      {
        id: 1,
        name: "Audio",
        sections: [
          {
            id: 2,
            name: "Power",
            tasks: [
              { taskId: 9, text: "New wording", checkoff: { ...CHECKED, text: "Old wording" } },
              { taskId: 10, text: "Never done", checkoff: null },
            ],
          },
        ],
      },
    ],
    removed: [{ taskId: 11, text: "Hidden at noon", checkoff: null, department: "Audio", section: "Power", removedAt: "2026-10-04T17:00:00.000Z" }],
    resets: [{ id: 3, at: "2026-10-04T13:00:00.000Z", by: "Test Director", archived: 4, undoneAt: null, undoneBy: null }],
  };
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

const openRecord = async () => {
  render(<HistoryPage search="?service=5" onAccessChanged={() => {}} onNavigate={() => {}} />);
  await screen.findByRole("heading", { name: "Sunday, October 4, 2026" });
};

describe("history page", () => {
  it("lists past services with X of Y, or tasks checked when there's no record, each linking to its record", async () => {
    const onNavigate = vi.fn();
    render(<HistoryPage search="" onAccessChanged={() => {}} onNavigate={onNavigate} />);
    const link = await screen.findByRole("link", { name: /Sunday, October 4, 2026/ });
    expect(link.textContent).toContain("Regular");
    expect(link.textContent).toContain("1 of 2 done · reset once");
    expect(screen.getByRole("link", { name: /September 27/ }).textContent).toContain("3 tasks checked");
    expect(link.getAttribute("href")).toBe("/admin/history?service=5");
    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalledWith("admin-history", "?service=5");
  });

  it("says so when there are no past services", async () => {
    list = { services: [], truncated: false };
    render(<HistoryPage search="" onAccessChanged={() => {}} onNavigate={() => {}} />);
    await screen.findByText("No past services yet.");
  });

  it("shows a recorded service's whole checklist with totals, unchecked and removed tasks", async () => {
    await openRecord();
    expect(screen.getByRole("progressbar", { name: "Overall progress" }).getAttribute("aria-valuetext")).toBe("1 of 2 tasks done");
    const checklist = screen.getByRole("region", { name: "Checklist" });
    expect(within(checklist).getByText("1 of 2 done")).toBeTruthy();
    const items = within(checklist).getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toMatch(/^Checked:New wordingTest Volunteer · .* · checked as “Old wording”$/);
    expect(items[1]).toBe("Not checked:Never doneNot checked");
    const removed = screen.getByRole("region", { name: "Removed during the service" });
    expect(removed.textContent).toContain("Hidden at noon");
    expect(removed.textContent).toContain("Audio › Power · removed");
    expect(screen.queryByText(/partway through/)).toBeNull();
  });

  it("says when the record started partway through", async () => {
    record.service.record = { from: "2026-10-03T15:00:00.000Z", partial: true };
    await openRecord();
    expect(screen.getByText(/partway through this service/)).toBeTruthy();
  });

  it("shows only checked tasks for a service without a record, and explains why", async () => {
    record = {
      ...record,
      service: { ...record.service, totalCount: null, record: null },
      categories: [{ id: 1, name: "Audio", sections: [{ id: 2, name: "Power", tasks: [{ taskId: 9, text: "Old wording", checkoff: { ...CHECKED, text: "Old wording" } }] }] }],
      removed: [],
    };
    await openRecord();
    const checked = screen.getByRole("region", { name: "Checked tasks" });
    expect(checked.textContent).toContain("from before the app kept a record");
    expect(within(checked).queryByText(/ of \d+ done/)).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByRole("region", { name: "Removed during the service" })).toBeNull();
  });

  it("shows resets and the activity log, and only reads", async () => {
    await openRecord();
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
