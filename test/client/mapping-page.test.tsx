// Stage 7a Team mapping screen (US-15): choose the Service Type, link teams and positions, mark "sees all
// departments", see what isn't linked yet and what's gone from the source, and refresh from it. Server first.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MappingResponse } from "../../src/shared/types";
import { MappingPage } from "../../src/client/pages/admin/MappingPage";

const AUDIO = { id: 2, name: "Audio Engineer" };
const CAMERAS = { id: 3, name: "Camera Operators" };
let data: MappingResponse;
let sent: { method: string; path: string; body: unknown }[];

const base = (): MappingResponse => ({
  source: { label: "Planning Center" },
  serviceTypes: [
    { externalId: "st-1", name: "Sunday Service" },
    { externalId: "st-2", name: "Special Events" },
  ],
  serviceTypeId: "st-1",
  list: { id: 1, name: "Regular" },
  departments: [AUDIO, CAMERAS],
  teams: [
    {
      externalId: "t-prod",
      name: "Production",
      link: null,
      isMediaTeam: true,
      notMediaTeam: false,
      positions: [
        { externalId: "p-audio", name: "Audio", link: { department: AUDIO, seesAll: false, outsideDefaultList: false }, status: "linked" },
        { externalId: "p-cam3", name: "Camera 3", link: null, status: "unlinked" },
      ],
    },
    { externalId: "t-band", name: "Worship Band", link: null, isMediaTeam: false, notMediaTeam: false, positions: [{ externalId: "p-keys", name: "Keys", link: null, status: "unlinked" }] },
  ],
  missing: [],
  unlinked: [{ team: "Production", position: "Camera 3" }],
  newTeams: [{ externalId: "t-band", name: "Worship Band" }],
  fetchedAt: "2026-10-10T14:00:00.000Z",
  timeZone: "America/Winnipeg",
});

beforeEach(() => {
  data = base();
  sent = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const method = init.method ?? "GET";
      const path = String(input);
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
      if (method !== "GET") {
        sent.push({ method, path, body: init.body ? JSON.parse(String(init.body)) : null });
        return new Response(null, { status: 204 });
      }
      return path === "/api/admin/mapping/status" ? json({ unlinked: 1, missing: 0, newTeams: 1 }) : json(data);
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderPage = async () => {
  render(<MappingPage onAccessChanged={() => {}} />);
  await screen.findByRole("heading", { name: "Team mapping" });
};
const team = (name: string) => screen.getByRole("heading", { name }).closest("div.overflow-hidden") as HTMLElement;

describe("team mapping page", () => {
  it("says so when the schedule source isn't connected", async () => {
    data = { ...base(), source: null, serviceTypes: [], serviceTypeId: null, teams: [], unlinked: [], newTeams: [], fetchedAt: null };
    await renderPage();
    expect(screen.getByText("Planning Center isn't connected yet")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Refresh/ })).toBeNull();
  });

  it("asks for the Service Type first, and saves the choice", async () => {
    data = { ...base(), serviceTypeId: null, teams: [], unlinked: [], newTeams: [] };
    await renderPage();
    expect(screen.getByText("Choose the Service Type to see its teams and positions.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Service Type the app follows"), { target: { value: "st-1" } });
    await waitFor(() => expect(sent).toEqual([{ method: "PUT", path: "/api/admin/mapping/service-type", body: { externalId: "st-1" } }]));
  });

  it("points out positions on a media team that aren't linked yet", async () => {
    await renderPage();
    const notice = screen.getByText(/1 position on a media team isn't linked to a department yet/).closest("div[role=status]") as HTMLElement;
    expect(notice.textContent).toContain("Production › Camera 3");
    expect(within(team("Production")).getByText("Media team: its members can use the app")).toBeTruthy();
    expect(within(team("Worship Band")).getByText("New: not linked yet. Link it if it's a media team.")).toBeTruthy();
  });

  it("links a position, and marks one as seeing all departments", async () => {
    await renderPage();
    const production = team("Production");
    // Unlinked: nothing to see all of yet.
    expect((within(production).getByRole("switch", { name: "Camera 3: sees all departments" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(production).getByLabelText("Camera 3"), { target: { value: String(CAMERAS.id) } });
    await waitFor(() =>
      expect(sent.at(-1)).toEqual({
        method: "PUT",
        path: "/api/admin/mapping/link",
        body: { teamExternalId: "t-prod", positionExternalId: "p-cam3", departmentId: CAMERAS.id, seesAll: false },
      }),
    );
    await screen.findByText("Production › Camera 3 is linked to Camera Operators.");

    fireEvent.click(within(production).getByRole("switch", { name: "Audio: sees all departments" }));
    await waitFor(() =>
      expect(sent.at(-1)?.body).toEqual({ teamExternalId: "t-prod", positionExternalId: "p-audio", departmentId: AUDIO.id, seesAll: true }),
    );
  });

  it("links a whole team, and shows positions following it", async () => {
    data.teams[0].link = { department: CAMERAS, seesAll: false, outsideDefaultList: false };
    data.teams[0].positions[1] = { ...data.teams[0].positions[1], status: "team" };
    data.unlinked = [];
    await renderPage();
    const production = team("Production");
    expect(within(production).getByText("Follows the team: Camera Operators")).toBeTruthy();
    // Each position offers to follow the team.
    expect(within(production).getAllByRole("option", { name: "Same as the team (Camera Operators)", hidden: true })).toHaveLength(2);
    fireEvent.change(within(production).getByLabelText("Whole team"), { target: { value: "" } });
    await waitFor(() => expect(sent.at(-1)?.body).toEqual({ teamExternalId: "t-prod", positionExternalId: null, departmentId: null, seesAll: false }));
  });

  it("flags links to things gone from the source, and removes them", async () => {
    data.missing = [{ teamExternalId: "t-prod", positionExternalId: "p-old", teamName: "Production", positionName: "Camera 9", department: CAMERAS }];
    await renderPage();
    expect(screen.getByText("A link points to something no longer in Planning Center")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove link" }));
    await waitFor(() => expect(sent.at(-1)?.body).toEqual({ teamExternalId: "t-prod", positionExternalId: "p-old", departmentId: null, seesAll: false }));
  });

  it("notes new teams (informational), and marks one “Not a media team” once", async () => {
    await renderPage();
    const note = screen.getByText("New team in Planning Center: Worship Band").closest("div[role=status]") as HTMLElement;
    expect(note.className).not.toContain("warning");
    expect(note.textContent).toContain("Link it if it's a media team, or mark it “Not a media team”.");
    // A media team can't be marked; a new one can.
    expect(within(team("Production")).queryByRole("button", { name: "Not a media team" })).toBeNull();
    fireEvent.click(within(team("Worship Band")).getByRole("button", { name: "Not a media team" }));
    await waitFor(() => expect(sent.at(-1)).toEqual({ method: "PUT", path: "/api/admin/mapping/team-review", body: { teamExternalId: "t-band", notMediaTeam: true } }));
    await screen.findByText("Worship Band is marked as not a media team.");
  });

  it("folds a team marked “Not a media team” to one line, with Undo", async () => {
    data.teams[1] = { ...data.teams[1], notMediaTeam: true };
    data.newTeams = [];
    await renderPage();
    expect(screen.queryByText(/New team/)).toBeNull();
    const band = screen.getByRole("heading", { name: "Worship Band" }).closest("div.flex") as HTMLElement;
    expect(band.textContent).toContain("Not a media team · 1 position, not linked");
    expect(screen.queryByLabelText("Keys")).toBeNull();
    fireEvent.click(within(band).getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(sent.at(-1)?.body).toEqual({ teamExternalId: "t-band", notMediaTeam: false }));
  });

  it("refreshes from the source on request", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Refresh from Planning Center" }));
    await waitFor(() => expect(sent).toEqual([{ method: "POST", path: "/api/admin/mapping/refresh", body: null }]));
    await screen.findByText("Teams and positions refreshed from Planning Center.");
  });
});
