import { describe, expect, it } from "vitest";

import { parseHabitFormValues } from "./habit-form-values";

const baseValues = {
  count: "3",
  description: "",
  endDate: "",
  name: "Morgenroutine",
  scheduleKind: "daily" as const,
  startDate: "2026-08-04",
  weekdays: [1],
};

describe("habit form values", () => {
  it("creates title-only daily habit details", () => {
    expect(parseHabitFormValues(baseValues)).toEqual({
      success: true,
      data: {
        name: "Morgenroutine",
        schedule: { kind: "daily" },
        startDate: "2026-08-04",
      },
    });
  });

  it("explains missing weekdays and invalid ranges", () => {
    expect(
      parseHabitFormValues({
        ...baseValues,
        endDate: "2026-08-03",
        scheduleKind: "weekdays",
        weekdays: [],
      }),
    ).toEqual({
      success: false,
      errors: {
        endDate: "Das Enddatum darf nicht vor dem Startdatum liegen.",
        weekdays: "Wähle mindestens einen Wochentag.",
      },
    });
  });

  it("rejects invalid weekly counts", () => {
    const result = parseHabitFormValues({
      ...baseValues,
      count: "8",
      scheduleKind: "timesPerWeek",
    });

    expect(result).toMatchObject({
      success: false,
      errors: { count: "Wähle eine Häufigkeit zwischen 1 und 7 pro Woche." },
    });
  });
});
