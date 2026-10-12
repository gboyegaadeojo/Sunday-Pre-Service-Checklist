// The department picker on phones and tablets (design.md §3C, §5): a control saying whose checklist is showing ("Your
// checklist", "Helping out: not your department" with "Back to mine", "Choose your department"), with a clear button
// name for screen readers, opening a bottom sheet: "Your departments" first (check mark on the current one), then
// "Other departments", with "Show all departments" in the sheet, remembered for the day.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChecklistResponse, ChecklistView, CurrentUser } from "../../src/shared/types";
import { ChecklistPage } from "../../src/client/pages/ChecklistPage";

const USER: CurrentUser = { id: 1, name: "Test TD", avatarUrl: null, isAdmin: false, isDirector: false, hasAccess: true };
const department = (id: number, name: string, tasks = 2, done = 0) => ({
  id,
  name,
  sections: [
    {
      id: id * 10,
      name: `${name} setup`,
      tasks: Array.from({ length: tasks }, (_, i) => ({
        id: id * 100 + i,
        text: `${name} task ${i + 1}`,
        checkoff: i < done ? { by: "Someone", at: "2026-10-11T14:00:00.000Z" } : null,
      })),
    },
  ],
});
let view: ChecklistView;
const body = (): ChecklistResponse => ({
  service: { id: 7, date: "2026-10-11", isToday: false, published: true, timeZone: "America/Winnipeg" },
  list: { id: 1, name: "Regular" },
  categories: [department(1, "Presentation", 3, 1), department(2, "Audio"), department(3, "Technical Director", 7)],
  view,
});

beforeAll(() => {
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & { showModal?: () => void };
  if (!proto.showModal) proto.showModal = function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
  if (!proto.close) proto.close = function (this: HTMLDialogElement) { this.removeAttribute("open"); };
});
beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body()), { headers: { "Content-Type": "application/json" } })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderPage = async () => {
  render(<ChecklistPage user={USER} onAccessChanged={() => {}} />);
  await screen.findByRole("region", { name: "Service overview" });
};
// The card's button (the compact bar, while hidden, is out of the accessibility tree).
const picker = () => screen.getAllByRole("button", { name: /Change department$/ })[0];
const sheet = () => screen.getByRole("dialog", { name: "Choose a department" });
/** The sheet's element, open or closed (a closed one leaves the accessibility tree, so it can't be found by name). */
const sheetElement = () => document.querySelector("dialog") as HTMLDialogElement;
const openSheet = () => {
  fireEvent.click(picker());
  return sheet();
};
const rows = (group: string) =>
  within(within(sheet()).getByRole("region", { name: group }))
    .getAllByRole("button")
    .map((b) => `${b.querySelector("span.flex-1")?.textContent}${b.getAttribute("aria-current") ? " ✓" : ""}`);

describe("the status line and the button", () => {
  it("says it's their checklist, with a name screen readers can use", async () => {
    view = { mode: "own", own: [3], note: null };
    await renderPage();
    expect(screen.getByText("Your checklist")).toBeTruthy();
    expect(picker().getAttribute("aria-label")).toBe("Technical Director, your checklist, 0 of 7 done. Change department");
    expect(picker().getAttribute("aria-haspopup")).toBe("dialog");
    expect(picker().textContent).toContain("Change");
  });

  it("says they're helping out on someone else's department, with a way back", async () => {
    view = { mode: "all", own: [3], note: null };
    await renderPage();
    within(openSheet()).getByRole("button", { name: /Presentation/ }).click();
    await waitFor(() => expect(screen.getByText("Helping out: not your department")).toBeTruthy());
    expect(picker().getAttribute("aria-label")).toBe("Presentation, helping out, not your department, 1 of 3 done. Change department");
    fireEvent.click(screen.getByRole("button", { name: "Back to mine" }));
    expect(screen.getByText("Your checklist")).toBeTruthy();
    expect(picker().getAttribute("aria-label")).toContain("Technical Director, your checklist");
  });

  it("asks someone with no department of their own to choose (not scheduled, or the schedule couldn't load)", async () => {
    for (const v of [
      { mode: "choose", own: [], note: "not_scheduled" },
      { mode: "choose", own: [], note: "schedule_unavailable" },
      { mode: "all", own: [], note: null },
    ] as ChecklistView[]) {
      view = v;
      await renderPage();
      expect(screen.getByText("Choose your department")).toBeTruthy();
      expect(screen.queryByText("Your checklist")).toBeNull();
      expect(screen.queryByRole("button", { name: "Back to mine" })).toBeNull();
      expect(picker().getAttribute("aria-label")).toBe("Presentation, choose your department, 1 of 3 done. Change department");
      cleanup();
    }
  });
});

describe("the sheet", () => {
  it("lists their departments first with a check on the current one, then the others with their counts", async () => {
    view = { mode: "all", own: [3], note: null };
    await renderPage();
    openSheet();
    expect(rows("Your departments")).toEqual(["Technical Director ✓"]);
    expect(rows("Other departments")).toEqual(["Presentation", "Audio"]);
    expect(within(sheet()).getByRole("button", { name: /Presentation/ }).textContent).toContain("1 of 3 done");
    expect(within(sheet()).queryByRole("switch")).toBeNull(); // Admins and "sees all" positions see everything anyway
  });

  it("holds Show all departments for a scheduled volunteer, remembered for the day", async () => {
    view = { mode: "own", own: [3], note: null };
    await renderPage();
    openSheet();
    expect(rows("Your departments")).toEqual(["Technical Director ✓"]);
    expect(within(sheet()).queryByRole("region", { name: "Other departments" })).toBeNull();
    fireEvent.click(within(sheet()).getByRole("switch", { name: "Show all departments" }));
    expect(rows("Other departments")).toEqual(["Presentation", "Audio"]);

    cleanup();
    await renderPage();
    openSheet();
    expect(within(sheet()).getByRole("switch", { name: "Show all departments" }).getAttribute("aria-checked")).toBe("true");
    expect(rows("Other departments")).toHaveLength(2);
  });

  it("lists one group for someone with no department of their own", async () => {
    view = { mode: "choose", own: [], note: "not_scheduled" };
    await renderPage();
    openSheet();
    expect(rows("Departments")).toEqual(["Presentation ✓", "Audio", "Technical Director"]);
    expect(within(sheet()).queryByRole("region", { name: "Your departments" })).toBeNull();
  });

  it("works from the keyboard: opens on the current row, picks, and Escape or Done closes it", async () => {
    view = { mode: "all", own: [3], note: null };
    await renderPage();
    picker().focus();
    fireEvent.click(picker());
    await waitFor(() => expect(document.activeElement?.textContent).toContain("Technical Director"));
    expect(picker().getAttribute("aria-expanded")).toBe("true");

    fireEvent(sheetElement(), new Event("cancel", { cancelable: true })); // Escape
    await waitFor(() => expect(picker().getAttribute("aria-expanded")).toBe("false"));
    expect(sheetElement().hasAttribute("open")).toBe(false);

    openSheet();
    fireEvent.click(within(sheet()).getByRole("button", { name: /^Audio/ }));
    await waitFor(() => expect(picker().getAttribute("aria-label")).toContain("Audio, helping out"));
    expect(sheetElement().hasAttribute("open")).toBe(false);

    openSheet();
    fireEvent.click(within(sheet()).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(sheetElement().hasAttribute("open")).toBe(false));
  });

  it("has 48px rows", async () => {
    view = { mode: "all", own: [3], note: null };
    await renderPage();
    openSheet();
    for (const row of within(sheet()).getAllByRole("button", { name: /done$/ })) expect(row.className).toContain("min-h-12");
  });
});

// The compact bar (design.md §3C): once the card scrolls up under the header, a one-line bar under the header keeps the
// department, its count and the save status in view (US-06) and opens the same sheet. Hidden (inert, out of the
// accessibility tree) otherwise.
describe("the compact bar on scroll", () => {
  let report: (entry: Partial<IntersectionObserverEntry>) => void = () => {};
  beforeEach(() => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: (entries: Partial<IntersectionObserverEntry>[]) => void) {
          report = (entry) => callback([entry]);
        }
        observe() {}
        disconnect() {}
      },
    );
  });
  const scrolledPast = (past: boolean) =>
    act(() => report({ isIntersecting: !past, boundingClientRect: { top: past ? -120 : 200 } as DOMRectReadOnly }));
  const pickers = () => screen.queryAllByRole("button", { name: /Change department$/ });

  it("appears once the card has scrolled away, opens the sheet, and goes again when the card is back", async () => {
    view = { mode: "own", own: [3], note: null };
    await renderPage();
    expect(pickers()).toHaveLength(1); // just the card

    scrolledPast(true);
    const [, compact] = pickers();
    expect(compact.getAttribute("aria-label")).toBe("Technical Director, your checklist, 0 of 7 done. Change department");
    expect(compact.textContent).toContain("0/7");
    fireEvent.click(compact);
    expect(sheetElement().hasAttribute("open")).toBe(true);
    fireEvent.click(within(sheet()).getByRole("button", { name: "Done" }));

    scrolledPast(false);
    expect(pickers()).toHaveLength(1);
    expect(compact.closest("[inert]")).not.toBeNull(); // out of the keyboard order while hidden
  });

  it("is a bar surface (design.md §2, Surfaces)", async () => {
    view = { mode: "own", own: [3], note: null };
    await renderPage();
    scrolledPast(true);
    expect(pickers()[1].className).toContain("bar");
  });
});
