import { describe, expect, it } from "vitest";

import {
  addCalendarDays,
  addCalendarMonths,
  calendarDayForInstant,
  differenceInCalendarDays,
  enumerateCalendarDays,
  getCalendarMonth,
  getCalendarMonthBounds,
  getIsoWeekBounds,
  getIsoWeekday,
  getWeekStart,
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

  it("starts the week on Monday or on Sunday", () => {
    expect(getWeekStart("2026-08-09")).toBe("2026-08-03");
    expect(getWeekStart("2026-08-03", 1)).toBe("2026-08-03");
    // Sonntag beginnt die Woche selbst, der Montag gehört zur Woche davor.
    expect(getWeekStart("2026-08-09", 7)).toBe("2026-08-09");
    expect(getWeekStart("2026-08-03", 7)).toBe("2026-08-02");
    expect(getWeekStart("2026-08-08", 7)).toBe("2026-08-02");
  });

  it("names the month of a day", () => {
    expect(getCalendarMonth("2026-08-31")).toBe("2026-08");
    expect(getCalendarMonth("2026-01-01")).toBe("2026-01");
  });

  it("moves months across the turn of the year", () => {
    expect(addCalendarMonths("2026-08", 1)).toBe("2026-09");
    expect(addCalendarMonths("2026-12", 1)).toBe("2027-01");
    expect(addCalendarMonths("2026-01", -1)).toBe("2025-12");
    expect(addCalendarMonths("2026-08", -20)).toBe("2024-12");
    expect(addCalendarMonths("2026-08", 0)).toBe("2026-08");
  });

  it("builds months with 28, 29, 30 and 31 days", () => {
    expect(getCalendarMonthBounds("2026-02")).toEqual([
      "2026-02-01",
      "2026-02-28",
    ]);
    expect(getCalendarMonthBounds("2028-02")).toEqual([
      "2028-02-01",
      "2028-02-29",
    ]);
    expect(getCalendarMonthBounds("2026-04")).toEqual([
      "2026-04-01",
      "2026-04-30",
    ]);
    expect(getCalendarMonthBounds("2026-08")).toEqual([
      "2026-08-01",
      "2026-08-31",
    ]);
    expect(getCalendarMonthBounds("2026-12")).toEqual([
      "2026-12-01",
      "2026-12-31",
    ]);
  });

  it("keeps a DST month at its full length", () => {
    const [from, to] = getCalendarMonthBounds("2026-03");

    expect(enumerateCalendarDays(from, to)).toHaveLength(31);
    expect(enumerateCalendarDays(from, to)).toContain("2026-03-29");
  });
});
