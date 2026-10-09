// Stage 5a editor UI: hiding always confirms first and explains what goes with it; inline edits save
// through the server and the editor shows only what the server accepted.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminListResponse } from "../../src/shared/types";
import { ChecklistEditorPage } from "../../src/client/pages/admin/ChecklistEditorPage";

let data: AdminListResponse;
let calls: string[];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  data = {
    list: { id: 1, name: "Test list", description: null, isDefault: true },
    categories: [
      {
        id: 10,
        name: "Audio",
        linkCount: 2,
        sections: [{ id: 100, name: "Power On", tasks: [{ id: 1000, text: "Turn on the console" }, { id: 1001, text: "Load the scene" }] }],
      },
    ],
  };
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const path = String(input);
      const method = init.method ?? "GET";
      if (method !== "GET") calls.push(`${method} ${path} ${init.body ?? ""}`.trim());
      if (path === "/api/admin/lists/default") return json(data);
      if (method === "PATCH" && path === "/api/admin/categories/10") {
        data.categories[0].name = JSON.parse(String(init.body)).name;
        return new Response(null, { status: 204 });
      }
      if (method === "DELETE") {
        data.categories = [];
        return new Response(null, { status: 204 });
      }
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
  render(<ChecklistEditorPage onAccessChanged={() => {}} />);
  await screen.findByText("Audio");
};
const openMenu = (label: string) => fireEvent.click(screen.getByRole("button", { name: label }));

describe("checklist editor", () => {
  it("never hides without confirming, and says what goes with it", async () => {
    await renderEditor();
    openMenu("Actions for department: Audio");
    fireEvent.click(screen.getByRole("button", { name: "Hide department" }));
    expect(calls).toEqual([]); // nothing sent yet

    const dialog = screen.getByRole("dialog", { name: "Hide this department?", hidden: true });
    expect(dialog.textContent).toContain("Its 1 section and 2 tasks will be hidden with it.");
    expect(dialog.textContent).toContain("Its 2 Planning Center links will be removed");
    expect(dialog.textContent).toContain("past services keep their records");

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel", hidden: true }));
    expect(calls).toEqual([]);

    openMenu("Actions for department: Audio");
    fireEvent.click(screen.getByRole("button", { name: "Hide department" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Hide department", hidden: true }));
    await waitFor(() => expect(calls).toEqual(["DELETE /api/admin/categories/10"]));
    await screen.findByText("This checklist has no departments yet.");
  });

  it("renames inline: Enter saves through the server, and the new name shows once accepted", async () => {
    await renderEditor();
    openMenu("Actions for department: Audio");
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    const field = screen.getByLabelText("Department name") as HTMLInputElement;
    expect(field.value).toBe("Audio");
    fireEvent.change(field, { target: { value: "  Audio Engineer  " } });
    fireEvent.keyDown(field, { key: "Enter" });

    await screen.findByText("Audio Engineer");
    expect(calls).toEqual(['PATCH /api/admin/categories/10 {"name":"Audio Engineer"}']);
    expect(screen.queryByLabelText("Department name")).toBeNull();
    expect(screen.getByText("All changes saved")).toBeTruthy();
  });

  it("Escape cancels an edit without sending anything", async () => {
    await renderEditor();
    openMenu("Actions for department: Audio");
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    const field = screen.getByLabelText("Department name");
    fireEvent.change(field, { target: { value: "Something else" } });
    fireEvent.keyDown(field, { key: "Escape" });
    expect(screen.getByText("Audio")).toBeTruthy();
    expect(calls).toEqual([]);
  });
});
