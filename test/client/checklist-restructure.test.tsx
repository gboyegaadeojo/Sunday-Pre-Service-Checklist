// Stage 5b editor UI: Move up/down respect the ends, "Move to…" picks a department then a section and
// never offers the current place, and Hidden items asks before restoring a hidden parent too (US-13a).
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminListResponse, HiddenItemsResponse } from "../../src/shared/types";
import { ChecklistEditorPage } from "../../src/client/pages/admin/ChecklistEditorPage";
import { HiddenItemsPage } from "../../src/client/pages/admin/HiddenItemsPage";

let list: AdminListResponse;
let hidden: HiddenItemsResponse;
let calls: string[];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  list = {
    list: { id: 1, name: "Test list", description: null, isDefault: true },
    categories: [
      {
        id: 10,
        name: "Audio",
        linkCount: 0,
        sections: [
          { id: 100, name: "Power On", tasks: [{ id: 1000, text: "Turn on the console" }, { id: 1001, text: "Load the scene" }] },
          { id: 101, name: "Mics", tasks: [] },
        ],
      },
      { id: 20, name: "Cameras", linkCount: 0, sections: [{ id: 200, name: "Setup", tasks: [] }] },
      { id: 30, name: "Lighting", linkCount: 0, sections: [] },
    ],
  };
  hidden = {
    list: { id: 1, name: "Test list" },
    timeZone: "America/Winnipeg",
    items: [
      {
        kind: "task",
        id: 1002,
        name: "Check batteries",
        hiddenAt: "2026-10-04T15:00:00.000Z",
        category: { id: 10, name: "Audio", hidden: false },
        section: { id: 102, name: "Old section", hidden: true },
      },
      { kind: "task", id: 1003, name: "Test the pastor's mic", hiddenAt: "2026-10-03T15:00:00.000Z", category: { id: 10, name: "Audio", hidden: false }, section: { id: 100, name: "Power On", hidden: false } },
    ],
  };
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const path = String(input);
      const method = init.method ?? "GET";
      if (method !== "GET") {
        calls.push(`${method} ${path} ${init.body ?? ""}`.trim());
        return new Response(null, { status: 204 });
      }
      if (path === "/api/admin/lists/default") return json(list);
      if (path === "/api/admin/lists/default/hidden") return json(hidden);
      return json({ error: "Not found" }, 404);
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

const renderEditor = async () => {
  render(<ChecklistEditorPage listRef="default" onAccessChanged={() => {}} onNavigate={() => {}} />);
  await screen.findByText("Audio");
  fireEvent.click(screen.getByRole("button", { name: /^Audio/ })); // expand
};
const menuItem = (menu: string, item: string) => {
  fireEvent.click(screen.getByRole("button", { name: menu }));
  return screen.getByRole("button", { name: item }) as HTMLButtonElement;
};

describe("reordering", () => {
  it("disables Move up on the first item and Move down on the last", async () => {
    await renderEditor();
    expect(menuItem("Actions for task: Turn on the console", "Move up").disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Move down" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Actions for task: Turn on the console" })); // close
    expect(menuItem("Actions for department: Lighting", "Move down").disabled).toBe(true);
  });

  it("sends the move to the server", async () => {
    await renderEditor();
    fireEvent.click(menuItem("Actions for section: Power On", "Move down"));
    await waitFor(() => expect(calls).toEqual(['POST /api/admin/sections/100/reorder {"direction":"down"}']));
  });
});

describe("Move to…", () => {
  it("moves a task: pick a department, then a section; the current section can't be picked", async () => {
    await renderEditor();
    fireEvent.click(menuItem("Actions for task: Load the scene", "Move to…"));
    const dialog = screen.getByRole("dialog", { name: "Move task", hidden: true });
    const confirm = within(dialog).getByRole("button", { name: "Move task", hidden: true }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); // nothing chosen yet

    const current = within(dialog).getByRole("radio", { name: /Power On/, hidden: true }) as HTMLInputElement;
    expect(current.disabled).toBe(true);

    fireEvent.change(within(dialog).getByLabelText("Department"), { target: { value: "30" } });
    expect(dialog.textContent).toContain("This department has no sections yet.");

    fireEvent.change(within(dialog).getByLabelText("Department"), { target: { value: "20" } });
    fireEvent.click(within(dialog).getByRole("radio", { name: /Setup/, hidden: true }));
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);

    await waitFor(() => expect(calls).toEqual(['POST /api/admin/tasks/1001/move {"sectionId":200}']));
    await screen.findByText("Moved “Load the scene” to Cameras › Setup.");
  });

  it("moves a section to another department, never to its own", async () => {
    await renderEditor();
    fireEvent.click(menuItem("Actions for section: Mics", "Move to…"));
    const dialog = screen.getByRole("dialog", { name: "Move section", hidden: true });
    expect((within(dialog).getByRole("radio", { name: /Audio/, hidden: true }) as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole("radio", { name: /Lighting/, hidden: true }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Move section", hidden: true }));
    await waitFor(() => expect(calls).toEqual(['POST /api/admin/sections/101/move {"categoryId":30}']));
  });
});

describe("Hidden items", () => {
  const renderHidden = async () => {
    render(<HiddenItemsPage listRef="default" onAccessChanged={() => {}} onNavigate={() => {}} />);
    await screen.findByText("Check batteries");
  };

  it("restores straight away when the parents are visible", async () => {
    await renderHidden();
    fireEvent.click(screen.getByRole("button", { name: "Restore task: Test the pastor's mic" }));
    await waitFor(() => expect(calls).toEqual(['POST /api/admin/tasks/1003/restore {"withParents":false}']));
    await screen.findByText("Restored “Test the pastor's mic” to Audio › Power On.");
  });

  it("explains a hidden parent and offers to restore both", async () => {
    await renderHidden();
    expect(screen.getByText("Check batteries").parentElement?.textContent).toContain("In Audio › Old section (hidden)");
    fireEvent.click(screen.getByRole("button", { name: "Restore task: Check batteries" }));
    expect(calls).toEqual([]); // asks first

    const dialog = screen.getByRole("dialog", { name: "Restore its section too?", hidden: true });
    expect(dialog.textContent).toContain("It's in the section “Old section”, which is hidden.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Restore both", hidden: true }));
    await waitFor(() => expect(calls).toEqual(['POST /api/admin/tasks/1002/restore {"withParents":true}']));
  });
});
