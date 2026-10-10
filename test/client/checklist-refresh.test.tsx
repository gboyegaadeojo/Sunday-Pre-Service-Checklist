// The open checklist refreshes every 30 seconds while visible and right after returning to the tab,
// so resets and teammates' check-offs appear without a reload, and never undoes a tap on screen.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChecklistResponse, CurrentUser, TaskCheckoff } from "../../src/shared/types";
import { CHECKLIST_REFRESH_MS } from "../../src/client/lib/useChecklist";
import { ChecklistPage } from "../../src/client/pages/ChecklistPage";

const USER: CurrentUser = { id: 1, name: "Test Volunteer", avatarUrl: null, isAdmin: false, isDirector: false, hasAccess: true };
const TASKS = ["Task one", "Task two", "Task three"];

let checked: Map<number, TaskCheckoff>;
let gets: number;
let heldGets: Array<() => void>;
let holdGets: boolean;
let visibility: DocumentVisibilityState;

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const checklist = (): ChecklistResponse => ({
  service: { id: 7, date: "2026-10-11", isToday: true, published: false, timeZone: "America/Winnipeg" },
  list: { id: 1, name: "Test list" },
  categories: [
    { id: 1, name: "Department A", sections: [{ id: 1, name: "Section", tasks: TASKS.map((text, i) => ({ id: i + 1, text, checkoff: checked.get(i + 1) ?? null })) }] },
  ],
});

const teammate = (taskId: number) => checked.set(taskId, { by: "Teammate", at: "2026-10-11T14:00:00.000Z" });
const checkbox = (text: string) => screen.getByRole("checkbox", { name: new RegExp(text) }) as HTMLInputElement;
const checkedTexts = () => TASKS.filter((t) => checkbox(t).checked);
const setVisibility = (v: DocumentVisibilityState) => {
  visibility = v;
  document.dispatchEvent(new Event("visibilitychange"));
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  checked = new Map();
  gets = 0;
  heldGets = [];
  holdGets = false;
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const path = String(input);
      if (path === "/api/checklist") {
        gets += 1;
        const body = checklist(); // snapshot of the server at the moment the request arrives
        if (holdGets) return new Promise<Response>((resolve) => heldGets.push(() => resolve(json(body))));
        return json(body);
      }
      const taskId = Number(path.match(/\/tasks\/(\d+)\/checkoff$/)?.[1]);
      if (init.method === "PUT") checked.set(taskId, { by: USER.name, at: "2026-10-11T14:01:00.000Z" });
      else checked.delete(taskId);
      return json({ checkoff: checked.get(taskId) ?? null });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function renderLoaded() {
  render(<ChecklistPage user={USER} onAccessChanged={() => {}} />);
  await screen.findByText("Task one");
}

describe("checklist refresh", () => {
  it("shows a teammate's check-off within 30 seconds", async () => {
    await renderLoaded();
    teammate(2);
    await act(() => vi.advanceTimersByTimeAsync(CHECKLIST_REFRESH_MS));
    expect(checkedTexts()).toEqual(["Task two"]);
    expect(screen.getByText(/Teammate ·/)).toBeTruthy();
  });

  it("shows a reset (everything cleared) within 30 seconds", async () => {
    teammate(1);
    teammate(3);
    await renderLoaded();
    expect(checkedTexts()).toEqual(["Task one", "Task three"]);
    checked.clear(); // a Director resets
    await act(() => vi.advanceTimersByTimeAsync(CHECKLIST_REFRESH_MS));
    expect(checkedTexts()).toEqual([]);
  });

  it("does not poll while the tab is hidden, and refreshes as soon as it is visible again", async () => {
    await renderLoaded();
    const before = gets;
    act(() => setVisibility("hidden"));
    teammate(1);
    await act(() => vi.advanceTimersByTimeAsync(CHECKLIST_REFRESH_MS * 3));
    expect(gets).toBe(before);
    expect(checkedTexts()).toEqual([]);

    await act(async () => setVisibility("visible"));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(gets).toBe(before + 1);
    expect(checkedTexts()).toEqual(["Task one"]);
  });

  it("never unticks a tap when a refresh that started before it arrives after it", async () => {
    await renderLoaded();
    holdGets = true;
    await act(() => vi.advanceTimersByTimeAsync(CHECKLIST_REFRESH_MS)); // refresh starts; server has nothing checked
    expect(heldGets).toHaveLength(1);

    fireEvent.click(checkbox("Task three")); // tap while that refresh is in flight
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(checkedTexts()).toEqual(["Task three"]);

    holdGets = false;
    await act(async () => {
      for (const release of heldGets.splice(0)) release(); // the stale result arrives
    });
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(checkedTexts()).toEqual(["Task three"]);

    await act(() => vi.advanceTimersByTimeAsync(CHECKLIST_REFRESH_MS)); // the next refresh agrees with the server
    expect(checkedTexts()).toEqual(["Task three"]);
    expect([...checked.keys()]).toEqual([3]);
  });
});
