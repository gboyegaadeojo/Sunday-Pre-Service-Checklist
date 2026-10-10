// Choices remembered on this device for the rest of the day (US-05, US-04a): "Show all departments" and a department
// picked by hand. Keyed by today's date in the church's time zone (a setting), so they lapse at midnight there.
// Storage may be unavailable (private browsing, blocked site data): then nothing is remembered, and nothing breaks.

const today = (timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
const keyFor = (name: string, timeZone: string) => `checklist.${name}.${today(timeZone)}`;

export function recallForToday(name: string, timeZone: string): string | null {
  try {
    return window.localStorage.getItem(keyFor(name, timeZone));
  } catch {
    return null;
  }
}

export function rememberForToday(name: string, timeZone: string, value: string | null): void {
  try {
    const key = keyFor(name, timeZone);
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
    // Earlier days' choices are no use: drop them.
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(`checklist.${name}.`) && k !== key) window.localStorage.removeItem(k);
    }
  } catch {
    // Not remembered; the choice still applies until the page is reloaded.
  }
}
