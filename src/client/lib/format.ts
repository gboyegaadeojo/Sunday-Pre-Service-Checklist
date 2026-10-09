/** "Sunday, October 11, 2026" for a "YYYY-MM-DD" calendar date (no time-zone shift). */
export const formatServiceDate = (date: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );

/** "9:42 AM" for an ISO timestamp, shown in the church's time zone (a setting) so everyone sees the same time. */
export const formatTime = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(iso));
