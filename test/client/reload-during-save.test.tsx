// Reloading the page (or returning to the tab) while a check-off save is still in flight must never
// check any task other than the one tapped. Renders the real ChecklistPage against a fake server.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChecklistResponse, CurrentUser, TaskCheckoff } from "../../src/shared/types";
import { ChecklistPage } from "../../src/client/pages/ChecklistPage";

const USER: CurrentUser = { id: 1, name: "Test Volunteer", avatarUrl: null, isAdmin: false, isDirector: false, hasAccess: true };
const TASKS = ["Task one", "Task two", "Task three", "Task four"];

/** A tiny in-memory server. Writes apply as soon as they arrive (like D1); responses can be held back. */
function fakeServer() {
  const checked = new Map<number, TaskCheckoff>();
  const requests: string[] = [];
  const held: Array<() => void> = [];
  let holdWrites = false;

  const checklist = (): ChecklistResponse => ({
    service: { id: 7, date: "2026-10-11", isToday: true, published: false, timeZone: "America/Winnipeg" },
    list: { id: 1, name: "Test list" },
    view: { mode: "choose", own: [], note: null },
    categories: [
      {
        id: 1,
        name: "Department A",
        sections: [{ id: 1, name: "Section", tasks: TASKS.map((text, i) => ({ id: i + 1, text, checkoff: checked.get(i + 1) ?? null })) }],
      },
    ],
  });

  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const path = String(input);
    const method = init.method ?? "GET";
    requests.push(`${method} ${path}`);
    if (path === "/api/checklist") return json(checklist());

    const taskId = Number(path.match(/\/tasks\/(\d+)\/checkoff$/)?.[1]);
    if (method === "PUT" && !checked.has(taskId)) checked.set(taskId, { by: USER.name, at: "2026-10-11T14:00:00.000Z" });
    if (method === "DELETE") checked.delete(taskId);
    const respond = () => json({ checkoff: checked.get(taskId) ?? null });
    if (!holdWrites) return respond();
    return new Promise<Response>((resolve) => held.push(() => resolve(respond())));
  });

  return {
    fetchMock,
    requests,
    checked,
    holdWrites: (on: boolean) => {
      holdWrites = on;
    },
    releaseWrites: () => {
      for (const release of held.splice(0)) release();
    },
  };
}

const checkbox = (text: string) => screen.getByRole("checkbox", { name: new RegExp(text) }) as HTMLInputElement;
const checkedTexts = () => TASKS.filter((t) => checkbox(t).checked);
const renderPage = () => render(<ChecklistPage user={USER} onAccessChanged={() => {}} />);

let server: ReturnType<typeof fakeServer>;
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  server = fakeServer();
  vi.stubGlobal("fetch", server.fetchMock);
  consoleError = vi.spyOn(console, "error");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  consoleError.mockRestore();
});

describe("reloading while a save is in progress (client)", () => {
  it("a full page reload mid-save shows only the tapped task checked", async () => {
    const first = renderPage();
    await screen.findByText("Task two");

    server.holdWrites(true);
    fireEvent.click(checkbox("Task two"));
    expect(checkedTexts()).toEqual(["Task two"]); // optimistic

    // Reload: the old page goes away with its save still in flight, a fresh page loads.
    first.unmount();
    renderPage();
    await screen.findByText("Task two");
    await waitFor(() => expect(checkedTexts()).toEqual(["Task two"]));

    // The old page's response arrives after it is gone; nothing else changes.
    await act(async () => server.releaseWrites());
    expect(checkedTexts()).toEqual(["Task two"]);
    expect([...server.checked.keys()]).toEqual([2]);
    expect(server.requests.filter((r) => !r.startsWith("GET"))).toEqual(["PUT /api/services/7/tasks/2/checkoff"]);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("returning to the tab mid-save does not reload over the pending save or check anything else", async () => {
    renderPage();
    await screen.findByText("Task three");

    server.holdWrites(true);
    fireEvent.click(checkbox("Task three"));
    const getsBefore = server.requests.filter((r) => r.startsWith("GET")).length;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(server.requests.filter((r) => r.startsWith("GET")).length).toBe(getsBefore); // no reload while saving

    await act(async () => server.releaseWrites());
    await waitFor(() => expect(screen.getByText("All changes saved")).toBeTruthy());
    expect(checkedTexts()).toEqual(["Task three"]);
    expect([...server.checked.keys()]).toEqual([3]);
    expect(server.requests.filter((r) => !r.startsWith("GET"))).toEqual(["PUT /api/services/7/tasks/3/checkoff"]);
  });

  it("rapid taps on different tasks each save only their own task", async () => {
    renderPage();
    await screen.findByText("Task four");

    server.holdWrites(true);
    fireEvent.click(checkbox("Task one"));
    fireEvent.click(checkbox("Task four"));
    fireEvent.click(checkbox("Task four")); // ignored: its save is still in flight
    await act(async () => server.releaseWrites());

    expect(checkedTexts()).toEqual(["Task one", "Task four"]);
    expect([...server.checked.keys()].sort()).toEqual([1, 4]);
    expect(server.requests.filter((r) => !r.startsWith("GET"))).toEqual([
      "PUT /api/services/7/tasks/1/checkoff",
      "PUT /api/services/7/tasks/4/checkoff",
    ]);
  });
});
