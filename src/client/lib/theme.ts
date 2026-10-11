import { useCallback, useEffect, useState } from "react";

// Appearance (US-08a, requirements v1.21): each person chooses Dark, Light or System in the name menu (or on the
// sign-in screen), remembered on this device. Dark is the default. System isn't a third look: it picks Dark or Light from the device's setting,
// and follows it when it changes. The inline script in index.html applies the stored choice before the page first
// draws (no flash); keep its key, values and logic in step with this file.

export type ThemePreference = "dark" | "light" | "system";
export type Theme = "dark" | "light";

export const THEME_KEY = "appearance";
const PREFERENCES: readonly ThemePreference[] = ["dark", "light", "system"];
/** The browser bar colour for each theme (the header's panel colour). */
const THEME_COLOR: Record<Theme, string> = { dark: "#0a0a0a", light: "#ffffff" };

const systemQuery = () => (typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: light)") : null);

/** The stored choice; Dark when there's none, it's unreadable, or storage is blocked. */
export function readPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return PREFERENCES.includes(stored as ThemePreference) ? (stored as ThemePreference) : "dark";
  } catch {
    return "dark";
  }
}

export const resolveTheme = (preference: ThemePreference): Theme =>
  preference === "system" ? (systemQuery()?.matches ? "light" : "dark") : preference;

/** Shows a theme on the page: every token follows `data-theme` on <html> (styles.css). */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
}

/** Saves a choice on this device (best effort: a blocked store just means it isn't remembered) and applies it. */
export function savePreference(preference: ThemePreference) {
  try {
    if (preference === "dark") window.localStorage.removeItem(THEME_KEY); // the default needs no entry
    else window.localStorage.setItem(THEME_KEY, preference);
  } catch {
    // Private window or blocked storage: it still applies for this visit.
  }
  applyTheme(resolveTheme(preference));
}

/**
 * Keeps System in step with the device: when its light/dark setting changes, the page switches without a reload,
 * whichever screen is open. Started once from main.tsx; returns a stop function (tests).
 */
export function startThemeSync(): () => void {
  applyTheme(resolveTheme(readPreference()));
  applyGlass(readGlass());
  const query = systemQuery();
  if (!query) return () => {};
  const onChange = () => {
    if (readPreference() === "system") applyTheme(resolveTheme("system"));
  };
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** The choice and the theme showing, for the name menu and the sign-in screen (re-rendered when the device's setting changes). */
export function useThemePreference() {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [, setDeviceLight] = useState(() => systemQuery()?.matches ?? false);
  useEffect(() => {
    const query = systemQuery();
    if (!query) return;
    const onChange = () => setDeviceLight(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  const setPreference = useCallback((next: ThemePreference) => {
    savePreference(next);
    setPreferenceState(next);
  }, []);
  return { preference, setPreference, theme: resolveTheme(preference) };
}

// Glass effects (requirements C40): on by default; each person can turn them off on this device, which shows the solid
// surfaces instead (`data-glass="off"` on <html>, styles.css). The inline script in index.html applies it before the
// page first draws, like the theme; keep the key and value in step.

export const GLASS_KEY = "glass";

/** Whether glass effects are on: yes unless this device has stored "off" (or storage is blocked and nothing's known). */
export function readGlass(): boolean {
  try {
    return window.localStorage.getItem(GLASS_KEY) !== "off";
  } catch {
    return true;
  }
}

/** Shows glass or the solid surfaces on the page. */
export function applyGlass(on: boolean) {
  if (on) delete document.documentElement.dataset.glass;
  else document.documentElement.dataset.glass = "off";
}

/** Saves the choice on this device (best effort; on needs no entry) and applies it. */
export function saveGlass(on: boolean) {
  try {
    if (on) window.localStorage.removeItem(GLASS_KEY);
    else window.localStorage.setItem(GLASS_KEY, "off");
  } catch {
    // Private window or blocked storage: it still applies for this visit.
  }
  applyGlass(on);
}

/** The glass choice, for the name menu and the sign-in screen. */
export function useGlassPreference() {
  const [glassOn, setGlassOnState] = useState(readGlass);
  const setGlassOn = useCallback((on: boolean) => {
    saveGlass(on);
    setGlassOnState(on);
  }, []);
  return { glassOn, setGlassOn };
}
