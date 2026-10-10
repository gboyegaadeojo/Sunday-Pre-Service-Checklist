// The Admin Overview (design.md §7): the current service at a glance from real checklist data (the same three
// figures as Progress, each department's status, the service's status) with a link to Progress, and the Admin
// sections as a menu with an icon and a line about each.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_SECTIONS } from "../../src/client/components/admin/AdminTabs";
import { OverviewPage } from "../../src/client/pages/admin/OverviewPage";
import type { ChecklistResponse } from "../../src/shared/types";

const body: ChecklistResponse = {
  service: { id: 7, date: "2026-10-11", isToday: false, published: false, timeZone: "America/Winnipeg", reset: null },
  list: { id: 1, name: "Regular" },
  categories: [
    { id: 1, name: "Audio", sections: [{ id: 10, name: "Setup", tasks: [{ id: 100, text: "Mics", checkoff: { by: "A", at: "2026-10-11T14:00:00.000Z" } }] }] },
    {
      id: 2,
      name: "Cameras",
      sections: [
        {
          id: 20,
          name: "Setup",
          tasks: [
            { id: 200, text: "Power", checkoff: { by: "B", at: "2026-10-11T14:00:00.000Z" } },
            { id: 201, text: "Lenses", checkoff: null },
          ],
        },
      ],
    },
    { id: 3, name: "Lyrics", sections: [{ id: 30, name: "Setup", tasks: [{ id: 300, text: "Import", checkoff: null }] }] },
  ],
  view: { mode: "all", own: [], note: null, source: "Planning Center" },
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      new Response(JSON.stringify(String(url).includes("mapping/status") ? { unlinked: 2, missing: 0, newTeams: 0 } : body), {
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Admin Overview", () => {
  it("shows the current service's figures, each department's status and the service's status, from the data", async () => {
    render(<OverviewPage onAccessChanged={() => {}} onNavigate={() => {}} />);
    const summary = await screen.findByRole("region", { name: "Overall progress" });
    expect(summary.textContent).toMatch(/Completed\s*2\s*of 4 tasks/);
    expect(summary.textContent).toMatch(/In progress\s*1\s*department/);
    expect(summary.textContent).toMatch(/Not started\s*1\s*department/);

    const rows = screen.getAllByRole("listitem").filter((li) => /of \d/.test(li.textContent ?? ""));
    expect(rows.map((r) => r.textContent)).toEqual(["Audio1 of 1Complete", "Cameras1 of 2In progress", "Lyrics0 of 1Not started"]);
    expect(within(screen.getByRole("list", { name: "Service status" })).getByText(/No service is published in Planning Center yet/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open Progress/ }).getAttribute("href")).toBe("/progress");
  });

  it("lists the Admin sections with an icon and one line each, and Team mapping's count", async () => {
    render(<OverviewPage onAccessChanged={() => {}} onNavigate={() => {}} />);
    const menu = await screen.findByRole("region", { name: "Admin sections" });
    const links = within(menu).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/admin/checklist",
      "/admin/lists",
      "/admin/mapping",
      "/admin/users",
      "/admin/activity",
      "/admin/history",
    ]);
    for (const s of ADMIN_SECTIONS.filter((x) => x.route !== "admin-overview")) {
      expect(within(menu).getByText(s.description)).toBeTruthy();
    }
    expect((await within(menu).findByText(/need linking/)).parentElement?.textContent).toBe("2 need linking");
  });
});
