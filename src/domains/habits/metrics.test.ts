import { describe, expect, it } from "vitest";

import { calculateHabitFulfillment, calculateHabitStreak } from "./metrics";
import { createHabit, createHabitEntry } from "./test-factories";

describe("habit metrics", () => {
  it("reports skipped separately and only counts done as fulfilled", () => {
    const habit = createHabit();
    const result = calculateHabitFulfillment(
      habit,
      [
        createHabitEntry("2026-08-03", "done"),
        createHabitEntry("2026-08-04", "skipped"),
      ],
      "2026-08-03",
      "2026-08-05",
    );

    expect(result).toEqual({
      done: 1,
      from: "2026-08-03",
      rate: 1 / 3,
      remaining: 2,
      skipped: 1,
      target: 3,
      to: "2026-08-05",
    });
  });

  it("calculates daily streaks from scheduled days with same-day grace", () => {
    const habit = createHabit({
      schedule: { kind: "weekdays", days: [1, 3, 5] },
    });
    const entries = [
      createHabitEntry("2026-08-03"),
      createHabitEntry("2026-08-05"),
    ];

    expect(calculateHabitStreak(habit, entries, "2026-08-07")).toEqual({
      best: 2,
      current: 2,
      unit: "day",
    });
    expect(
      calculateHabitStreak(
        habit,
        [...entries, createHabitEntry("2026-08-07", "skipped")],
        "2026-08-07",
      ),
    ).toEqual({ best: 2, current: 0, unit: "day" });
  });

  it("evaluates times-per-week targets and streaks by ISO week", () => {
    const habit = createHabit({ schedule: { kind: "timesPerWeek", count: 2 } });
    const entries = [
      createHabitEntry("2026-08-03"),
      createHabitEntry("2026-08-04"),
      createHabitEntry("2026-08-05"),
      createHabitEntry("2026-08-10"),
      createHabitEntry("2026-08-12"),
      createHabitEntry("2026-08-17", "skipped"),
    ];

    expect(
      calculateHabitFulfillment(habit, entries, "2026-08-03", "2026-08-16"),
    ).toMatchObject({ done: 4, rate: 1, skipped: 0, target: 4 });
    expect(calculateHabitStreak(habit, entries, "2026-08-17")).toEqual({
      best: 2,
      current: 2,
      unit: "week",
    });
  });

  it("keeps historical calculations stable for archived habits", () => {
    const habit = createHabit({ archivedAt: "2026-08-06T08:00:00.000Z" });

    expect(
      calculateHabitFulfillment(
        habit,
        [createHabitEntry("2026-08-03")],
        "2026-08-03",
        "2026-08-03",
      ).rate,
    ).toBe(1);
  });
});
