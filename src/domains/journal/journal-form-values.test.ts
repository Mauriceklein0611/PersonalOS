import { describe, expect, it } from "vitest";

import {
  isSameJournalFormValues,
  journalEntryToFormValues,
  parseJournalFormValues,
  type JournalFormValues,
} from "./journal-form-values";
import type { JournalEntry } from "./model";

const today = "2026-08-04";

describe("journal form values", () => {
  it("keeps omitted scales undefined instead of turning them into zero", () => {
    const result = parseJournalFormValues(
      createValues({ scales: { energy: "", mood: "4" } }),
      today,
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.mood).toBe(4);
    expect("energy" in result.data).toBe(false);
    expect(result.data.stress).toBeUndefined();
  });

  it("refuses an entry without any content and future days", () => {
    const empty = parseJournalFormValues(createValues(), today);
    expect(empty).toEqual({
      success: false,
      errors: {
        form: "Halte mindestens einen Wert oder Text fest, bevor du speicherst.",
      },
    });

    const future = parseJournalFormValues(
      createValues({ localDate: "2026-08-05", scales: { mood: "3" } }),
      today,
    );
    expect(future).toEqual({
      success: false,
      errors: { localDate: "Wähle heute oder einen vergangenen Tag." },
    });
  });

  it("trims texts and drops fields that only contain whitespace", () => {
    const result = parseJournalFormValues(
      createValues({ texts: { body: "   ", highlight: "  Ruhiger Tag  " } }),
      today,
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.highlight).toBe("Ruhiger Tag");
    expect(result.data.body).toBeUndefined();
  });

  it("maps a stored entry back into form values and detects changes", () => {
    const entry: JournalEntry = {
      id: "00000000-0000-4000-8000-000000001301",
      createdAt: "2026-08-04T18:00:00.000Z",
      updatedAt: "2026-08-04T18:00:00.000Z",
      localDate: "2026-08-04",
      mood: 4,
      highlight: "Spaziergang",
    };
    const values = journalEntryToFormValues(entry, today);

    expect(values.scales.mood).toBe("4");
    expect(values.scales.stress).toBe("");
    expect(values.texts.highlight).toBe("Spaziergang");
    expect(isSameJournalFormValues(values, values)).toBe(true);
    expect(
      isSameJournalFormValues(values, {
        ...values,
        scales: { ...values.scales, stress: "2" },
      }),
    ).toBe(false);
  });
});

function createValues(
  overrides: {
    localDate?: string;
    scales?: Partial<JournalFormValues["scales"]>;
    texts?: Partial<JournalFormValues["texts"]>;
  } = {},
): JournalFormValues {
  return {
    localDate: overrides.localDate ?? today,
    scales: {
      energy: "",
      mood: "",
      productivity: "",
      stress: "",
      ...overrides.scales,
    },
    texts: {
      body: "",
      gratitude: "",
      highlight: "",
      improvement: "",
      ...overrides.texts,
    },
  };
}
