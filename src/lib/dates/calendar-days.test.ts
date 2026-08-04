import { describe, expect, it } from "vitest";

import {
  addCalendarDays,
  calendarDayForInstant,
  enumerateCalendarDays,
  getIsoWeekBounds,
  getIsoWeekday,
} from "./calendar-days";

describe("calendar day helpers", () => {
  it("moves across month boundaries without applying a time zone", () => {
    expect(addCalendarDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(enumerateCalendarDays("2026-02-27", "2026-03-02")).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
  });

  it("uses ISO Monday-to-Sunday week boundaries", () => {
    expect(getIsoWeekday("2026-08-03")).toBe(1);
    expect(getIsoWeekday("2026-08-09")).toBe(7);
    expect(getIsoWeekBounds("2026-08-09")).toEqual([
      "2026-08-03",
      "2026-08-09",
    ]);
  });

  it("derives local days across DST and time-zone changes", () => {
    const instant = new Date("2026-03-29T22:30:00.000Z");

    expect(calendarDayForInstant(instant, "Europe/Berlin")).toBe("2026-03-30");
    expect(calendarDayForInstant(instant, "America/New_York")).toBe(
      "2026-03-29",
    );
  });
});
