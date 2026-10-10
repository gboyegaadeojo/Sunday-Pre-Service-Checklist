// Stage 5c.2 Reorder mode: arrows replace the ⋯ menus, each tap is one server move, focus follows the
// moved item (switching arrows at an end), and a tap while a move is saving is ignored.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminListResponse } from "../../src/shared/types";
import { ChecklistEditorPage } from "../../src/client/pages/admin/ChecklistEditorPage";

let data: AdminListResponse;
let calls: string[];

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  data = {
    list: { id: 1, name: "Test list", description: null, isDefault: true },
    categories: [
      {
        id: 10,
        name: "Audio",
        linkCount: 0,
        sections: [
          {
            id: 100,
            name: "Power On",
            tasks: [
              { id: 1, text: "First" },
              { id: 2, text: "Second" },
              { id: 3, text: "Third" },
            ],
          },
        ],
      },
      { id: 20, name: "Cameras", linkCount: 0, sections: [] },
    ],
  };
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const path = String(input);
      if ((init.method ?? "GET") === "GET") return json(data);
      calls.push(`${init.method} ${path} ${init.body}`);
      // Apply task reorders like the server does, so the editor reloads the new order.
      const m = path.match(/^\/api\/admin\/tasks\/(\d+)\/reorder$/);
      if (m) {
        const tasks = data.categories[0].sections[0].tasks;
        const i = tasks.findIndex((t) => t.id === Number(m[1]));
        const j = JSON.parse(String(init.body)).direction === "up" ? i - 1 : i + 1;
        [tasks[i], tasks[j]] = [tasks[j], tasks[i]];
      }
      return new Response(null, { status: 204 });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderInReorderMode = async () => {
  render(<ChecklistEditorPage listRef="default" onAccessChanged={() => {}} onNavigate={() => {}} />);
  await screen.findByText("Audio");
  fireEvent.click(screen.getByRole("button", { name: /^Audio/ })); // expand
  fireEvent.click(screen.getByRole("button", { name: "Reorder" }));
};
const arrow = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;
const taskOrder = () => data.categories[0].sections[0].tasks.map((t) => t.text);

describe("Reorder mode", () => {
  it("swaps each ⋯ menu for arrows, hides the Add buttons, and Done switches back", async () => {
    await renderInReorderMode();
    expect(screen.queryByRole("button", { name: /^Actions for/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add task" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add department" })).toBeNull();
    expect(screen.getByText("Reordering.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reorder" })).toBeNull(); // Done lives in the bar
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Done" })));
    expect(arrow("Move up department: Audio").disabled).toBe(true);
    expect(arrow("Move down department: Cameras").disabled).toBe(true);
    expect(arrow("Move up task: First").disabled).toBe(true);
    expect(arrow("Move down task: Third").disabled).toBe(true);
    expect(arrow("Move up section: Power On").disabled).toBe(true); // only section: both ends
    expect(arrow("Move down section: Power On").disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("button", { name: "Actions for task: First" })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Reorder" })));
    expect(screen.queryByRole("button", { name: /^Move up/ })).toBeNull();
  });

  it("moves one place per tap, keeping focus on the moved item, then on its other arrow at the end", async () => {
    await renderInReorderMode();
    fireEvent.click(arrow("Move down task: First"));
    await waitFor(() => expect(taskOrder()).toEqual(["Second", "First", "Third"]));
    await waitFor(() => expect(document.activeElement).toBe(arrow("Move down task: First")));

    fireEvent.click(arrow("Move down task: First"));
    await waitFor(() => expect(taskOrder()).toEqual(["Second", "Third", "First"]));
    // Now last: its down arrow is disabled, so focus moves to its up arrow.
    await waitFor(() => expect(document.activeElement).toBe(arrow("Move up task: First")));
    expect(calls).toEqual([
      'POST /api/admin/tasks/1/reorder {"direction":"down"}',
      'POST /api/admin/tasks/1/reorder {"direction":"down"}',
    ]);
  });

  it("ignores a tap while the previous move is still saving", async () => {
    await renderInReorderMode();
    act(() => {
      fireEvent.click(arrow("Move down task: First"));
      fireEvent.click(arrow("Move down task: Second"));
    });
    await waitFor(() => expect(taskOrder()).toEqual(["Second", "First", "Third"]));
    expect(calls).toHaveLength(1);
  });
});
