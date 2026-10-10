// Service-day calendar maths (US-07). Pure functions: the time zone and weekday always come from
// settings (US-11a), never from code. Dates are calendar dates ("YYYY-MM-DD") in the church's time zone.
// Shared: the Worker uses it for the current service, the Settings screen to preview a change.

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export class InvalidSettingError extends Error {}

/**
 * True for an IANA time zone name this runtime knows (e.g. "America/Winnipeg", "UTC"). Offsets such as
 * "+05:00", which Intl also accepts, are refused: they ignore daylight saving.
 */
export function isTimeZone(timeZone: string): boolean {
  if (!/^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/.test(timeZone)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Throws InvalidSettingError unless timeZone is a time zone this runtime knows (IANA name). */
export function assertTimeZone(timeZone: string): void {
  if (!isTimeZone(timeZone)) throw new InvalidSettingError(`time_zone setting "${timeZone}" is not a valid IANA time zone`);
}

/** Parses the service_weekday setting: 0 = Sunday … 6 = Saturday. */
export function parseWeekday(value: string): number {
  const n = Number(value);
  if (!/^[0-6]$/.test(value) || !Number.isInteger(n)) {
    throw new InvalidSettingError(`service_weekday setting "${value}" must be 0 (Sunday) to 6 (Saturday)`);
  }
  return n;
}

/** The calendar date and weekday of `instant` in `timeZone`. */
export function localDate(instant: Date, timeZone: string): { date: string; weekday: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday: WEEKDAYS.indexOf(parts.weekday) };
}

/** Adds whole days to a "YYYY-MM-DD" calendar date. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * The service date that is current at `instant` when no Planning Center plan applies (US-07):
 * today if today is the service weekday, otherwise the next one. A service therefore stays current
 * until 11:59 PM on its date in the church's time zone.
 */
export function currentServiceDate(instant: Date, timeZone: string, serviceWeekday: number): { date: string; isToday: boolean } {
  const today = localDate(instant, timeZone);
  const daysAhead = (serviceWeekday - today.weekday + 7) % 7;
  return { date: addDays(today.date, daysAhead), isToday: daysAhead === 0 };
}
