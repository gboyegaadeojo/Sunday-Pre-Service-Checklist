// Stage 5d.2 Settings page (US-11a): Save only when something changed, a live branding preview, the header
// refreshed after a branding save, and a confirmation before the current service moves to another date.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SettingsResponse } from "../../src/shared/types";
import { SettingsPage } from "../../src/client/pages/admin/SettingsPage";

let data: SettingsResponse;
let puts: unknown[];
const onBrandingChanged = vi.fn();

beforeEach(() => {
  // Friday, October 9, 2026, midday in Winnipeg: the current service is Sunday the 11th.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-09T17:00:00Z"));
  data = {
    settings: { timeZone: "America/Winnipeg", serviceWeekday: 0, shortName: "IFC", teamName: "IFC Production", appName: "Pre-Service Checklist" },
    currentService: { date: "2026-10-11", checkedCount: 0, fromPlan: false },
  };
  puts = [];
  onBrandingChanged.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init: RequestInit = {}) => {
      if (init.method === "PUT") {
        const body = JSON.parse(String(init.body));
        puts.push(body);
        const changed = Object.keys(body).filter((k) => body[k] !== data.settings[k as keyof typeof data.settings]);
        data = { ...data, settings: body };
        const currentServiceDate = body.serviceWeekday === 6 ? "2026-10-10" : "2026-10-11";
        return new Response(JSON.stringify({ changed, currentServiceDate }), { headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
    }),
  );
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & { showModal?: () => void };
  if (!proto.showModal) proto.showModal = function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
  if (!proto.close) proto.close = function (this: HTMLDialogElement) { this.removeAttribute("open"); };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const renderPage = async () => {
  render(<SettingsPage onAccessChanged={() => {}} onBrandingChanged={onBrandingChanged} />);
  await screen.findByRole("heading", { name: "Church settings" });
};
const save = () => screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement;

describe("Settings page", () => {
  it("saves branding: preview first, then the header refreshes", async () => {
    await renderPage();
    expect(save().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Team name"), { target: { value: "  Media Team " } });
    expect(save().disabled).toBe(false);
    expect(screen.getByText("Pre-Service Checklist · Media Team")).toBeTruthy(); // the tab title preview
    fireEvent.click(save());
    // Same service date, so no confirmation; values are sent trimmed.
    await waitFor(() => expect(puts).toEqual([{ ...data.settings, teamName: "Media Team" }]));
    await screen.findByText("Settings saved.");
    expect(onBrandingChanged).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(save().disabled).toBe(true)); // the form starts over from the saved values
  });

  it("doesn't predict a move when a published plan decides the current service (US-07)", async () => {
    data.currentService = { date: "2026-10-11", checkedCount: 5, fromPlan: true };
    await renderPage();
    fireEvent.change(screen.getByLabelText("Service day"), { target: { value: "6" } });
    expect(
      screen.getByText("Current service: Sunday, October 11, 2026, from Planning Center's plan. The service day is used when no plan is published."),
    ).toBeTruthy();
    fireEvent.click(save());
    // No "Move the current service?" confirmation: saved straight away.
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(screen.queryByRole("dialog", { name: "Move the current service?" })).toBeNull();
  });

  it("confirms before moving the current service, and warns about its check-offs", async () => {
    data.currentService = { date: "2026-10-11", checkedCount: 5, fromPlan: false };
    await renderPage();
    fireEvent.change(screen.getByLabelText("Service day"), { target: { value: "6" } });
    expect(screen.getByText("The current service will move from Sunday, October 11, 2026 to Saturday, October 10, 2026.")).toBeTruthy();
    fireEvent.click(save());
    const dialog = screen.getByRole("dialog", { name: "Move the current service?", hidden: true });
    expect(dialog.textContent).toContain("Sunday, October 11, 2026 has 5 tasks checked. They stay with that date");
    expect(puts).toEqual([]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes", hidden: true }));
    await waitFor(() => expect(puts).toEqual([{ ...data.settings, serviceWeekday: 6 }]));
    await screen.findByText("Settings saved. The current service is now Saturday, October 10, 2026.");
    expect(onBrandingChanged).not.toHaveBeenCalled();
  });

  it("discards unsaved changes", async () => {
    await renderPage();
    const shortName = screen.getByLabelText("Short name (logo mark)") as HTMLInputElement;
    fireEvent.change(shortName, { target: { value: "XYZ" } });
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(shortName.value).toBe("IFC");
    expect(save().disabled).toBe(true);
  });
});
