import { describe, expect, it } from "vitest";

import { calendarDayForInstant } from "../../lib/dates/calendar-days";
import { isHabitDueOn, isHabitEligibleOn } from "./schedule";
import { createHabit, createHabitEntry } from "./test-factories";

describe("habit schedules", () => {
  it("respects inclusive start/end dates and month changes", () => {
    const habit = createHabit({
      endDate: "2026-02-01",
      startDate: "2026-01-31",
    });

    expect(isHabitDueOn(habit, "2026-01-30")).toBe(false);
    expect(isHabitDueOn(habit, "2026-01-31")).toBe(true);
    expect(isHabitDueOn(habit, "2026-02-01")).toBe(true);
    expect(isHabitDueOn(habit, "2026-02-02")).toBe(false);
  });

  it("uses ISO weekdays across the Monday week boundary", () => {
    const habit = createHabit({
      schedule: { kind: "weekdays", days: [1, 7] },
    });

    expect(isHabitEligibleOn(habit, "2026-08-03")).toBe(true);
    expect(isHabitEligibleOn(habit, "2026-08-04")).toBe(false);
    expect(isHabitEligibleOn(habit, "2026-08-09")).toBe(true);
    expect(isHabitEligibleOn(habit, "2026-08-10")).toBe(true);
  });

  it("keeps a times-per-week habit due until its weekly target is reached", () => {
    const habit = createHabit({ schedule: { kind: "timesPerWeek", count: 2 } });
    const entries = [
      createHabitEntry("2026-08-03"),
      createHabitEntry("2026-08-04"),
    ];

    expect(isHabitDueOn(habit, "2026-08-03", entries)).toBe(true);
    expect(isHabitDueOn(habit, "2026-08-04", entries)).toBe(true);
    expect(isHabitDueOn(habit, "2026-08-05", entries)).toBe(false);
    expect(isHabitDueOn(habit, "2026-08-10", entries)).toBe(true);
  });

  it("derives due dates from the selected zone across the DST change", () => {
    const habit = createHabit({
      schedule: { kind: "weekdays", days: [1] },
      startDate: "2026-03-01",
    });
    const instant = new Date("2026-03-29T22:30:00.000Z");

    const berlinDay = calendarDayForInstant(instant, "Europe/Berlin");
    const newYorkDay = calendarDayForInstant(instant, "America/New_York");
    expect(berlinDay).toBe("2026-03-30");
    expect(newYorkDay).toBe("2026-03-29");
    expect(isHabitDueOn(habit, berlinDay)).toBe(true);
    expect(isHabitDueOn(habit, newYorkDay)).toBe(false);
  });
});
