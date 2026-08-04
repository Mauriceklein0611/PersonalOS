import { describe, expect, it } from "vitest";

import {
  addCalendarDays,
  calendarDayForInstant,
  differenceInCalendarDays,
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

  it("keeps the local day stable around both Berlin DST switches", () => {
    // Umstellung auf Sommerzeit: 2026-03-29 springt 02:00 auf 03:00.
    expect(
      calendarDayForInstant(
        new Date("2026-03-28T23:30:00.000Z"),
        "Europe/Berlin",
      ),
    ).toBe("2026-03-29");
    expect(
      calendarDayForInstant(
        new Date("2026-03-29T00:30:00.000Z"),
        "Europe/Berlin",
      ),
    ).toBe("2026-03-29");
    expect(
      calendarDayForInstant(
        new Date("2026-03-29T22:30:00.000Z"),
        "Europe/Berlin",
      ),
    ).toBe("2026-03-30");

    // Umstellung auf Winterzeit: 2026-10-25 wiederholt die Stunde 02:00.
    expect(
      calendarDayForInstant(
        new Date("2026-10-25T00:30:00.000Z"),
        "Europe/Berlin",
      ),
    ).toBe("2026-10-25");
    expect(
      calendarDayForInstant(
        new Date("2026-10-25T23:30:00.000Z"),
        "Europe/Berlin",
      ),
    ).toBe("2026-10-26");
  });

  it("counts calendar days without letting a DST day become 23 or 25 hours", () => {
    expect(addCalendarDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addCalendarDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(addCalendarDays("2026-10-25", 1)).toBe("2026-10-26");

    expect(differenceInCalendarDays("2026-03-28", "2026-03-30")).toBe(2);
    expect(differenceInCalendarDays("2026-10-24", "2026-10-26")).toBe(2);
    expect(differenceInCalendarDays("2026-08-04", "2026-08-04")).toBe(0);
    expect(differenceInCalendarDays("2026-08-05", "2026-08-04")).toBe(-1);

    expect(getIsoWeekBounds("2026-03-29")).toEqual([
      "2026-03-23",
      "2026-03-29",
    ]);
    expect(enumerateCalendarDays("2026-10-24", "2026-10-26")).toEqual([
      "2026-10-24",
      "2026-10-25",
      "2026-10-26",
    ]);
  });
});
