import { describe, expect, it } from "vitest";

import { taskCategories } from "./model";
import { parseTaskFormValues, type TaskFormValues } from "./task-form-values";

const validValues: TaskFormValues = {
  categoryId: taskCategories[0].id,
  dueLocal: "",
  estimatedMinutes: "25",
  notes: "Neutrale Notiz",
  plannedDate: "2026-08-05",
  priority: "normal",
  title: "Synthetische Aufgabe",
};

describe("task form values", () => {
  it("normalizes valid optional values", () => {
    expect(parseTaskFormValues(validValues)).toMatchObject({
      success: true,
      data: {
        categoryId: taskCategories[0].id,
        estimatedMinutes: 25,
        plannedDate: "2026-08-05",
        title: "Synthetische Aufgabe",
      },
    });
  });

  it("explains invalid duration and calendar values", () => {
    expect(
      parseTaskFormValues({
        ...validValues,
        estimatedMinutes: "0.5",
        plannedDate: "2026-02-30",
      }),
    ).toEqual({
      success: false,
      errors: {
        estimatedMinutes:
          "Gib eine ganze Dauer zwischen 1 und 100.000 Minuten ein.",
        plannedDate: "Wähle ein gültiges Plandatum.",
      },
    });
  });
});
