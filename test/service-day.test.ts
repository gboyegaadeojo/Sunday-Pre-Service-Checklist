import { describe, expect, it } from "vitest";
import {
  InvalidSettingError,
  addDays,
  assertTimeZone,
  currentServiceDate,
  localDate,
  parseWeekday,
} from "../src/worker/lib/service-day";

const SUNDAY = 0;
const WEDNESDAY = 3;
const WPG = "America/Winnipeg";

describe("currentServiceDate (US-07)", () => {
  it.each([
    // [instant (UTC), expected service date, isToday, why]
    ["2026-10-11T15:00:00Z", "2026-10-11", true, "Sunday 10 AM in Winnipeg"],
    ["2026-10-12T04:59:00Z", "2026-10-11", true, "Sunday 11:59 PM in Winnipeg is still that Sunday"],
    ["2026-10-12T05:00:00Z", "2026-10-18", false, "Monday 12:00 AM in Winnipeg moves to next Sunday"],
    ["2026-10-11T03:00:00Z", "2026-10-11", false, "Saturday 10 PM in Winnipeg, already Sunday in UTC"],
    ["2026-10-10T18:00:00Z", "2026-10-11", false, "Saturday afternoon"],
    ["2026-10-14T12:00:00Z", "2026-10-18", false, "midweek"],
  ])("%s -> %s", (instant, date, isToday) => {
    expect(currentServiceDate(new Date(instant), WPG, SUNDAY)).toEqual({ date, isToday });
  });

  it("handles the daylight-saving change (Nov 1, 2026)", () => {
    // 11:30 PM CST Sunday Nov 1 = 05:30 UTC Nov 2; still that Sunday.
    expect(currentServiceDate(new Date("2026-11-02T05:30:00Z"), WPG, SUNDAY)).toEqual({ date: "2026-11-01", isToday: true });
    // 12:30 AM CST Monday Nov 2 = 06:30 UTC.
    expect(currentServiceDate(new Date("2026-11-02T06:30:00Z"), WPG, SUNDAY)).toEqual({ date: "2026-11-08", isToday: false });
  });

  it("uses whatever weekday and time zone the settings say (US-11a)", () => {
    // Wednesday services in Auckland: 2026-10-13T12:00Z is Wednesday 1 AM NZDT.
    expect(currentServiceDate(new Date("2026-10-13T12:00:00Z"), "Pacific/Auckland", WEDNESDAY)).toEqual({
      date: "2026-10-14",
      isToday: true,
    });
    expect(currentServiceDate(new Date("2026-10-13T12:00:00Z"), WPG, WEDNESDAY)).toEqual({ date: "2026-10-14", isToday: false });
  });
});

describe("calendar helpers", () => {
  it("localDate gives the date and weekday in the time zone", () => {
    expect(localDate(new Date("2026-10-11T03:00:00Z"), WPG)).toEqual({ date: "2026-10-10", weekday: 6 });
  });

  it("addDays crosses month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-27", 6)).toBe("2027-01-02");
  });
});

describe("settings validation", () => {
  it("rejects unknown time zones", () => {
    expect(() => assertTimeZone("Mars/Olympus_Mons")).toThrow(InvalidSettingError);
    expect(() => assertTimeZone(WPG)).not.toThrow();
  });

  it("accepts weekdays 0-6 only", () => {
    expect(parseWeekday("0")).toBe(0);
    expect(parseWeekday("6")).toBe(6);
    for (const bad of ["7", "-1", "", "Sunday", "1.5", " 1"]) expect(() => parseWeekday(bad)).toThrow(InvalidSettingError);
  });
});
