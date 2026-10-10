// The Admin home (design.md §7, requirements v1.20): "Needs attention" lists only problems an Admin can fix, each
// linking to Team mapping, or "Nothing needs your attention"; then a shortcut to every section; no progress numbers,
// one link to Progress.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_SECTIONS } from "../../src/client/components/admin/AdminLayout";
import { attentionItems, resetMappingStatus } from "../../src/client/lib/adminAttention";
import { AdminHomePage } from "../../src/client/pages/admin/AdminHomePage";
import type { MappingStatusResponse } from "../../src/shared/types";

const CALM: MappingStatusResponse = { unlinked: 0, missing: 0, newTeams: 0, ready: true, connected: true };
let status: MappingStatusResponse;

beforeEach(() => {
  resetMappingStatus();
  status = CALM;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(status), { headers: { "Content-Type": "application/json" } })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const attention = async () => {
  render(<AdminHomePage onNavigate={() => {}} />);
  const section = screen.getByRole("region", { name: "Needs attention" });
  await within(section).findByText(/Nothing needs your attention|Fix in Team mapping/, {}, { timeout: 2000 }).catch(() => {});
  return section;
};

describe("Needs attention", () => {
  it("says nothing needs attention when all is well", async () => {
    const section = await attention();
    expect(await within(section).findByText("Nothing needs your attention.")).toBeTruthy();
  });

  it("lists each admin-fixable problem, each linking to Team mapping", async () => {
    status = { unlinked: 3, missing: 1, newTeams: 1, ready: false, connected: true, unreachable: "Planning Center" };
    const section = await attention();
    const items = await within(section).findAllByRole("listitem");
    expect(items.map((li) => li.querySelector("p")?.textContent)).toEqual([
      "Couldn't reach Planning Center just now",
      "Team mapping isn't set up",
      "3 positions on media teams not linked to a department",
      "1 link points to something no longer in the schedule",
      "1 new team to review",
    ]);
    for (const li of items) {
      expect(within(li).getByRole("link", { name: "Fix in Team mapping" }).getAttribute("href")).toBe("/admin/mapping");
    }
  });

  it("shows nothing to fix when no schedule source is connected at all (not an Admin's fix)", () => {
    expect(attentionItems({ ...CALM, ready: false, connected: false })).toEqual([]);
  });
});

describe("the rest of the Admin home", () => {
  it("has a shortcut card for every section with its line, no progress numbers, and one link to Progress", async () => {
    render(<AdminHomePage onNavigate={() => {}} />);
    const shortcuts = screen.getByRole("region", { name: "Shortcuts" });
    const links = within(shortcuts).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(ADMIN_SECTIONS.filter((s) => s.route !== "admin-home").map((s) => (s.route === "admin-checklist" ? "/admin/checklist" : `/admin/${s.route.slice(6)}`)));
    for (const s of ADMIN_SECTIONS.filter((x) => x.route !== "admin-home")) expect(within(shortcuts).getByText(s.description)).toBeTruthy();
    expect(screen.getByRole("link", { name: "See today's progress" }).getAttribute("href")).toBe("/progress");
    expect(screen.queryByRole("region", { name: "Overall progress" })).toBeNull();
    expect(screen.queryByText(/of \d+ tasks/)).toBeNull();
  });
});
