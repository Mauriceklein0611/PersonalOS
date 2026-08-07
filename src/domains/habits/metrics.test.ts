import { describe, expect, it } from "vitest";

import { calculateHabitFulfillment, calculateHabitStreak } from "./metrics";
import { createHabit, createHabitEntry } from "./test-factories";

describe("habit metrics", () => {
  it("reports skipped separately and leaves it out of the denominator", () => {
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

    // Drei geplante Tage, einer übersprungen: Die Quote läuft gegen zwei.
    expect(result).toEqual({
      counted: 2,
      done: 1,
      from: "2026-08-03",
      rate: 1 / 2,
      remaining: 1,
      skipped: 1,
      target: 3,
      to: "2026-08-05",
    });
  });

  it("gives no rate when every planned unit was skipped", () => {
    const habit = createHabit();
    const result = calculateHabitFulfillment(
      habit,
      [
        createHabitEntry("2026-08-03", "skipped"),
        createHabitEntry("2026-08-04", "skipped"),
      ],
      "2026-08-03",
      "2026-08-04",
    );

    expect(result).toMatchObject({ counted: 0, rate: null, skipped: 2 });
  });

  it("keeps a skipped day from breaking the daily streak", () => {
    const habit = createHabit();
    const entries = [
      createHabitEntry("2026-08-03", "done"),
      createHabitEntry("2026-08-04", "skipped"),
      createHabitEntry("2026-08-05", "done"),
    ];

    // Der übersprungene Tag verlängert die Serie nicht, bricht sie aber auch
    // nicht: zwei erledigte Tage bleiben eine Serie.
    expect(calculateHabitStreak(habit, entries, "2026-08-05")).toEqual({
      best: 2,
      current: 2,
      unit: "day",
    });
  });

  it("breaks the daily streak on a planned day without an entry", () => {
    const habit = createHabit();
    const entries = [
      createHabitEntry("2026-08-03", "done"),
      createHabitEntry("2026-08-05", "done"),
    ];

    expect(calculateHabitStreak(habit, entries, "2026-08-05")).toEqual({
      best: 1,
      current: 1,
      unit: "day",
    });
  });

  it("does not let a fully skipped week extend the weekly streak", () => {
    const habit = createHabit({ schedule: { kind: "timesPerWeek", count: 2 } });
    const entries = [
      createHabitEntry("2026-08-03"),
      createHabitEntry("2026-08-04"),
      createHabitEntry("2026-08-10", "skipped"),
      createHabitEntry("2026-08-11", "skipped"),
      createHabitEntry("2026-08-17"),
      createHabitEntry("2026-08-18"),
    ];

    // Die übersprungene Woche ist neutral: Sie hält die Serie, ohne sie zu
    // verlängern.
    expect(calculateHabitStreak(habit, entries, "2026-08-23")).toEqual({
      best: 2,
      current: 2,
      unit: "week",
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
    // Ein Überspringen am heutigen Tag lässt die Serie unberührt.
    expect(
      calculateHabitStreak(
        habit,
        [...entries, createHabitEntry("2026-08-07", "skipped")],
        "2026-08-07",
      ),
    ).toEqual({ best: 2, current: 2, unit: "day" });
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
