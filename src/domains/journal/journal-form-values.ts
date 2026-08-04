import { calendarDaySchema } from "../../lib/dates/date-values";
import {
  hasJournalContent,
  journalEntryDetailsSchema,
  journalScaleKeys,
  journalTextKeys,
  type JournalEntry,
  type JournalEntryDetails,
  type JournalScaleKey,
  type JournalTextKey,
} from "./model";

export type JournalFormValues = {
  localDate: string;
  scales: Record<JournalScaleKey, string>;
  texts: Record<JournalTextKey, string>;
};

export type JournalFormErrors = Partial<
  Record<JournalScaleKey | JournalTextKey | "form" | "localDate", string>
>;

export type JournalFormParseResult =
  | { success: true; data: JournalEntryDetails }
  | { success: false; errors: JournalFormErrors };

export function parseJournalFormValues(
  values: JournalFormValues,
  today: string,
): JournalFormParseResult {
  const errors: JournalFormErrors = {};
  if (!calendarDaySchema.safeParse(values.localDate).success) {
    errors.localDate = "Wähle einen gültigen Tag.";
  } else if (values.localDate > today) {
    errors.localDate = "Wähle heute oder einen vergangenen Tag.";
  }

  const scales: Partial<Record<JournalScaleKey, number>> = {};
  for (const key of journalScaleKeys) {
    const raw = values.scales[key];
    if (raw === "") continue;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      errors[key] = "Wähle einen Wert von 1 bis 5 oder „Keine Angabe“.";
      continue;
    }
    scales[key] = value;
  }

  const texts: Partial<Record<JournalTextKey, string>> = {};
  for (const key of journalTextKeys) {
    const value = values.texts[key].trim();
    if (value.length === 0) continue;
    if (value.length > 50_000) {
      errors[key] = "Der Text darf höchstens 50.000 Zeichen enthalten.";
      continue;
    }
    texts[key] = value;
  }

  if (Object.keys(errors).length > 0) return { success: false, errors };

  const candidate = { localDate: values.localDate, ...scales, ...texts };
  const result = journalEntryDetailsSchema.safeParse(candidate);
  if (!result.success) {
    return {
      success: false,
      errors: { form: "Prüfe die eingetragenen Werte für diesen Tag." },
    };
  }
  if (!hasJournalContent(result.data)) {
    return {
      success: false,
      errors: {
        form: "Halte mindestens einen Wert oder Text fest, bevor du speicherst.",
      },
    };
  }
  return { success: true, data: result.data };
}

export function journalEntryToFormValues(
  entry: JournalEntry | undefined,
  localDate: string,
): JournalFormValues {
  return {
    localDate: entry?.localDate ?? localDate,
    scales: {
      energy: toScaleValue(entry?.energy),
      mood: toScaleValue(entry?.mood),
      productivity: toScaleValue(entry?.productivity),
      stress: toScaleValue(entry?.stress),
    },
    texts: {
      body: entry?.body ?? "",
      gratitude: entry?.gratitude ?? "",
      highlight: entry?.highlight ?? "",
      improvement: entry?.improvement ?? "",
    },
  };
}

export function isSameJournalFormValues(
  left: JournalFormValues,
  right: JournalFormValues,
): boolean {
  return (
    left.localDate === right.localDate &&
    journalScaleKeys.every((key) => left.scales[key] === right.scales[key]) &&
    journalTextKeys.every(
      (key) => left.texts[key].trim() === right.texts[key].trim(),
    )
  );
}

function toScaleValue(value: number | undefined): string {
  return value === undefined ? "" : String(value);
}
