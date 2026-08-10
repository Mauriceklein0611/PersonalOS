import { describe, expect, it } from "vitest";

import { habitDetailsSchema, habitEntryDetailsSchema } from "./model";

describe("habit schemas", () => {
  it("accepts the three supported schedule kinds", () => {
    for (const schedule of [
      { kind: "daily" },
      { kind: "weekdays", days: [1, 3, 5] },
      { kind: "timesPerWeek", count: 3 },
    ]) {
      expect(
        habitDetailsSchema.safeParse({
          name: "Synthetische Routine",
          schedule,
          startDate: "2026-08-03",
        }).success,
      ).toBe(true);
    }
  });

  it("rejects duplicate weekdays and reversed date ranges", () => {
    expect(
      habitDetailsSchema.safeParse({
        name: "Synthetische Routine",
        schedule: { kind: "weekdays", days: [1, 1] },
        startDate: "2026-08-03",
      }).success,
    ).toBe(false);
    expect(
      habitDetailsSchema.safeParse({
        endDate: "2026-08-02",
        name: "Synthetische Routine",
        schedule: { kind: "daily" },
        startDate: "2026-08-03",
      }).success,
    ).toBe(false);
  });

  it("allows only done and skipped daily entries", () => {
    const details = {
      habitId: "00000000-0000-4000-8000-000000001001",
      localDate: "2026-08-04",
    };
    expect(
      habitEntryDetailsSchema.safeParse({ ...details, status: "done" }).success,
    ).toBe(true);
    expect(
      habitEntryDetailsSchema.safeParse({ ...details, status: "open" }).success,
    ).toBe(false);
  });
});
