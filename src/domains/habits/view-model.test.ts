import { describe, expect, it } from "vitest";

import { createHabit, createHabitEntry } from "./test-factories";
import {
  formatHabitRate,
  formatHabitStreak,
  getHabitActivityState,
  getHabitDayState,
  getHabitProgressRange,
  getHabitScheduleLabel,
  getHabitTargetUnitLabel,
} from "./view-model";

describe("habit view model", () => {
  it("distinguishes open, done, skipped and not-due days", () => {
    const habit = createHabit({
      schedule: { kind: "weekdays", days: [1, 3] },
    });

    expect(getHabitDayState(habit, [], "2026-08-03")).toBe("open");
    expect(
      getHabitDayState(habit, [createHabitEntry("2026-08-03")], "2026-08-03"),
    ).toBe("done");
    expect(
      getHabitDayState(
        habit,
        [createHabitEntry("2026-08-05", "skipped")],
        "2026-08-05",
      ),
    ).toBe("skipped");
    expect(getHabitDayState(habit, [], "2026-08-04")).toBe("not-due");
  });

  it("keeps recorded history visible after a schedule change", () => {
    const habit = createHabit({
      schedule: { kind: "weekdays", days: [1] },
    });

    expect(
      getHabitDayState(habit, [createHabitEntry("2026-08-04")], "2026-08-04"),
    ).toBe("done");
  });

  it("labels lifecycle and schedule states without relying on color", () => {
    expect(
      getHabitActivityState(
        createHabit({ startDate: "2026-08-05" }),
        "2026-08-04",
      ),
    ).toBe("upcoming");
    expect(
      getHabitActivityState(
        createHabit({ endDate: "2026-08-03" }),
        "2026-08-04",
      ),
    ).toBe("paused");
    expect(getHabitScheduleLabel({ kind: "weekdays", days: [1, 3, 5] })).toBe(
      "Mo, Mi, Fr",
    );
  });

  it("never starts a progress period before the habit exists", () => {
    const habit = createHabit({ startDate: "2026-08-03" });

    expect(getHabitProgressRange(habit, "last28Days", "2026-08-05")).toEqual({
      from: "2026-08-03",
      to: "2026-08-05",
    });
    expect(getHabitProgressRange(habit, "last7Days", "2026-08-20")).toEqual({
      from: "2026-08-14",
      to: "2026-08-20",
    });
    expect(getHabitProgressRange(habit, "sinceStart", "2026-08-20")).toEqual({
      from: "2026-08-03",
      to: "2026-08-20",
    });
    expect(
      getHabitProgressRange(habit, "sinceStart", "2026-08-02"),
    ).toBeUndefined();
  });

  it("names the calculation basis and formats streaks and rates", () => {
    expect(getHabitTargetUnitLabel({ kind: "daily" })).toBe("geplanten Tagen");
    expect(getHabitTargetUnitLabel({ kind: "timesPerWeek", count: 3 })).toBe(
      "geplanten Wocheneinheiten",
    );
    expect(formatHabitStreak("day", 1)).toBe("1 Tag");
    expect(formatHabitStreak("week", 2)).toBe("2 Wochen");
    expect(formatHabitRate(null)).toBe("Keine Angabe");
    expect(formatHabitRate(0.5)).toBe("50 %");
  });
});
