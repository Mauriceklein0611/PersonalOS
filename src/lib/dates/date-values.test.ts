import { describe, expect, it } from "vitest";

import {
  createIsoInstant,
  nextUpdatedAt,
  parseCalendarDay,
  parseCalendarMonth,
  parseIsoInstant,
  timeZoneSchema,
} from "./date-values";

describe("date value helpers", () => {
  it("accepts UTC instants with millisecond precision", () => {
    expect(parseIsoInstant("2026-08-04T08:30:00.000Z")).toBe(
      "2026-08-04T08:30:00.000Z",
    );
    expect(createIsoInstant(new Date("2026-08-04T08:30:00Z"))).toBe(
      "2026-08-04T08:30:00.000Z",
    );
    expect(() => parseIsoInstant("2026-08-04T10:30:00+02:00")).toThrow();
  });

  it("validates calendar days and months without timezone conversion", () => {
    expect(parseCalendarDay("2026-02-28")).toBe("2026-02-28");
    expect(parseCalendarMonth("2026-02")).toBe("2026-02");
    expect(() => parseCalendarDay("2026-02-30")).toThrow();
    expect(() => parseCalendarMonth("2026-13")).toThrow();
  });

  it("never moves an update timestamp backwards", () => {
    const previous = "2026-08-04T08:30:00.000Z";
    const clock = { now: () => new Date("2026-08-04T08:29:00.000Z") };

    expect(nextUpdatedAt(previous, clock)).toBe(previous);
  });

  it("accepts only supported IANA time zones", () => {
    expect(timeZoneSchema.parse("Europe/Berlin")).toBe("Europe/Berlin");
    expect(timeZoneSchema.safeParse("Berlin").success).toBe(false);
  });
});
