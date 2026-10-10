// Stage 5c Activity view: check-offs and checklist edits in one feed, newest first, with a filter; edits
// read as before → after (US-07a, US-13b).
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivityResponse, ChecklistEditEvent, ChecklistEditsResponse } from "../../src/shared/types";
import { ActivityPage } from "../../src/client/pages/ActivityPage";

const actor = { user: "Test Admin", sessionId: "sess1234abcd", tabId: "tab1234abcd" };
const edit = (id: number, at: string, e: Partial<ChecklistEditEvent>): ChecklistEditEvent => ({
  id,
  at,
  action: "rename",
  kind: "task",
  itemId: 1,
  itemName: "",
  before: null,
  after: null,
  ...actor,
  ...e,
});

const checkoffs: ActivityResponse = {
  service: { id: 1, date: "2026-10-11", timeZone: "America/Winnipeg" },
  events: [
    { id: 5, at: "2026-10-11T15:02:00.000Z", action: "check", outcome: "applied", taskId: 9, taskText: "Open ProPresenter", affected: null, ...actor },
  ],
  truncated: false,
};
const edits: ChecklistEditsResponse = {
  list: { id: 1, name: "Test list" },
  timeZone: "America/Winnipeg",
  events: [
    edit(3, "2026-10-11T15:03:00.000Z", {
      action: "move",
      itemName: "Clean the lenses",
      before: { place: { department: { id: 1, name: "Audio" }, section: { id: 2, name: "Power On" }, position: 2 } },
      after: { place: { department: { id: 3, name: "Cameras" }, section: { id: 4, name: "Setup" }, position: 1 } },
    }),
    edit(2, "2026-10-11T15:01:00.000Z", { kind: "category", itemName: "Audio Engineer", before: { name: "Audio" }, after: { name: "Audio Engineer" } }),
    edit(1, "2026-10-04T15:00:00.000Z", { action: "hide", kind: "category", itemName: "Lighting", before: { teamLinks: ["Production › Lights"] } }),
  ],
  truncated: false,
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const body = String(input) === "/api/services/current/events" ? checkoffs : edits;
      return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const rows = () => screen.getAllByRole("listitem").map((li) => li.textContent);

describe("Activity", () => {
  it("shows check-offs and edits together, newest first, and filters them", async () => {
    render(<ActivityPage onAccessChanged={() => {}} />);
    await screen.findByText("Open ProPresenter");
    expect(rows().map((r) => r?.match(/Moved|Checked|Renamed|Hid/)?.[0])).toEqual(["Moved", "Checked", "Renamed", "Hid"]);

    fireEvent.click(screen.getByRole("button", { name: "Checklist edits" }));
    expect(screen.getByRole("button", { name: "Checklist edits" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByText("Open ProPresenter")).toBeNull();
    expect(rows()).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "Check-offs" }));
    expect(rows()).toHaveLength(1);
  });

  it("describes each edit with its before and after values", async () => {
    render(<ActivityPage onAccessChanged={() => {}} />);
    await screen.findByText("Open ProPresenter");
    expect(screen.getByText("Task “Clean the lenses”: Audio › Power On → Cameras › Setup")).toBeTruthy();
    expect(screen.getByText("Department: “Audio” → “Audio Engineer”")).toBeTruthy();
    expect(screen.getByText("Department “Lighting”. Removed Planning Center links: Production › Lights")).toBeTruthy();
  });
});
