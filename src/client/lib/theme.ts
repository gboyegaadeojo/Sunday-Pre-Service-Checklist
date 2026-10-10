import { useCallback, useEffect, useState } from "react";

// Appearance (US-08a, requirements v1.20): each person chooses Dark, Light or System on My Preferences, remembered
// on this device. Dark is the default. System isn't a third look: it picks Dark or Light from the device's setting,
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
  const query = systemQuery();
  if (!query) return () => {};
  const onChange = () => {
    if (readPreference() === "system") applyTheme(resolveTheme("system"));
  };
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** The choice and the theme showing, for My Preferences (re-rendered when the device's setting changes). */
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
