// Appearance (US-08a, requirements v1.20): Dark, Light or System, chosen in the name menu (or on the sign-in screen)
// and remembered on the device. Dark is the default; System follows the device and changes with it without a reload.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_KEY, readPreference, savePreference, startThemeSync } from "../../src/client/lib/theme";
import { SignInScreen } from "../../src/client/components/app/SignInScreen";
import { UserMenu } from "../../src/client/components/app/UserMenu";
import type { CurrentUser } from "../../src/shared/types";

/** A stand-in for the device's light/dark setting, which tests can flip. */
function mockDevice(light: boolean) {
  const listeners = new Set<() => void>();
  const state = { light };
  const query = {
    get matches() {
      return state.light;
    },
    addEventListener: (_: string, f: () => void) => listeners.add(f),
    removeEventListener: (_: string, f: () => void) => listeners.delete(f),
  };
  vi.stubGlobal("matchMedia", vi.fn(() => query));
  return {
    set(next: boolean) {
      state.light = next;
      for (const f of listeners) f();
    },
  };
}
const shown = () => document.documentElement.dataset.theme;

let stop = () => {};
beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});
afterEach(() => {
  stop();
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the preference", () => {
  it("is Dark by default, and when what's stored isn't a known choice", () => {
    mockDevice(true);
    expect(readPreference()).toBe("dark");
    window.localStorage.setItem(THEME_KEY, "purple");
    expect(readPreference()).toBe("dark");
    stop = startThemeSync();
    expect(shown()).toBe("dark"); // even on a light device: Dark is the default, System is opt-in
  });

  it("is remembered on the device and applied at once; Dark needs no entry", () => {
    mockDevice(false);
    savePreference("light");
    expect(window.localStorage.getItem(THEME_KEY)).toBe("light");
    expect(shown()).toBe("light");
    savePreference("dark");
    expect(window.localStorage.getItem(THEME_KEY)).toBeNull();
    expect(shown()).toBe("dark");
  });

  it("still applies when the device blocks storage, and reads as Dark", () => {
    mockDevice(false);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readPreference()).toBe("dark");
    savePreference("light");
    expect(shown()).toBe("light");
  });

  it("System follows the device, and switches when the device does, without a reload", () => {
    const device = mockDevice(false);
    window.localStorage.setItem(THEME_KEY, "system");
    stop = startThemeSync();
    expect(shown()).toBe("dark");
    device.set(true);
    expect(shown()).toBe("light");
    device.set(false);
    expect(shown()).toBe("dark");
  });

  it("a chosen Dark or Light ignores the device", () => {
    const device = mockDevice(false);
    window.localStorage.setItem(THEME_KEY, "dark");
    stop = startThemeSync();
    device.set(true);
    expect(shown()).toBe("dark");
  });
});

describe("choosing it", () => {
  const ADMIN: CurrentUser = { id: 1, name: "Test Admin", avatarUrl: null, isAdmin: true, isDirector: false, hasAccess: true };
  const openMenu = () => {
    render(<UserMenu user={ADMIN} route="checklist" onNavigate={() => {}} onSignOut={() => {}} signingOut={false} signOutError={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Account: Test Admin" }));
    return screen.getByRole("menu");
  };

  it("is a row in the name menu: picks apply at once and keep the menu open", () => {
    mockDevice(true);
    const menu = openMenu();
    const group = within(menu).getByRole("group", { name: "Appearance" });
    const radios = within(group).getAllByRole("menuitemradio");
    expect(radios.map((r) => [r.textContent, r.getAttribute("aria-checked")])).toEqual([
      ["Dark", "true"],
      ["Light", "false"],
      ["System", "false"],
    ]);
    fireEvent.click(radios[1]);
    expect(shown()).toBe("light");
    expect(window.localStorage.getItem(THEME_KEY)).toBe("light");
    expect(screen.getByRole("menu")).toBeTruthy(); // still open
    expect(within(menu).getByRole("menuitemradio", { name: "Light" }).getAttribute("aria-checked")).toBe("true");
  });

  it("works from the keyboard: the row is one stop for up and down, left and right move along it", async () => {
    mockDevice(false);
    const menu = openMenu();
    const [dark, light, system] = within(menu).getAllByRole("menuitemradio");
    const [admin, signOut] = within(menu).getAllByRole("menuitem");
    await waitFor(() => expect(document.activeElement).toBe(dark)); // the chosen option gets focus on opening
    fireEvent.keyDown(dark, { key: "ArrowRight" });
    expect(document.activeElement).toBe(light);
    fireEvent.keyDown(light, { key: "ArrowRight" });
    expect(document.activeElement).toBe(system);
    fireEvent.keyDown(system, { key: "ArrowRight" });
    expect(document.activeElement).toBe(dark); // wraps
    fireEvent.keyDown(dark, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(system);
    fireEvent.keyDown(system, { key: "ArrowDown" }); // from anywhere in the row, down goes to the next item
    expect(document.activeElement).toBe(admin);
    fireEvent.keyDown(admin, { key: "ArrowDown" });
    expect(document.activeElement).toBe(signOut);
    fireEvent.keyDown(signOut, { key: "ArrowDown" });
    expect(document.activeElement).toBe(dark); // back to the row's chosen option
  });

  it("is on the sign-in screen too, before anyone signs in", () => {
    mockDevice(false);
    render(<SignInScreen />);
    fireEvent.click(screen.getByRole("radio", { name: "Light" }));
    expect(shown()).toBe("light");
    expect((screen.getByRole("radio", { name: "Light" }) as HTMLInputElement).checked).toBe(true);
  });
});
