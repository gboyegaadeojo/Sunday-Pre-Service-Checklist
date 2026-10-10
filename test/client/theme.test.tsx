// Appearance (US-08a, requirements v1.20): Dark, Light or System, chosen on My Preferences and remembered on the
// device. Dark is the default; System follows the device and changes with it without a reload.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_KEY, readPreference, savePreference, startThemeSync } from "../../src/client/lib/theme";
import { PreferencesPage } from "../../src/client/pages/PreferencesPage";

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

describe("My Preferences", () => {
  it("offers Dark, Light and System, applies a choice at once, and says what's showing", () => {
    const device = mockDevice(true);
    render(<PreferencesPage />);
    expect(screen.getByRole("heading", { level: 1, name: "My Preferences" })).toBeTruthy();
    expect(screen.getByText("Manage your personal appearance and display preferences.")).toBeTruthy();
    const group = screen.getByRole("group", { name: "Appearance" });
    expect(group).toBeTruthy();
    expect((screen.getByRole("radio", { name: "Dark" }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("Dark on this device (the default).");

    fireEvent.click(screen.getByRole("radio", { name: "Light" }));
    expect(shown()).toBe("light");
    expect(window.localStorage.getItem(THEME_KEY)).toBe("light");
    expect((screen.getByRole("radio", { name: "Light" }) as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByRole("radio", { name: "System" }));
    expect(screen.getByRole("status").textContent).toBe("Following your device: Light. It changes when your device does.");
    act(() => device.set(false));
    expect(screen.getByRole("status").textContent).toBe("Following your device: Dark. It changes when your device does.");
  });
});
