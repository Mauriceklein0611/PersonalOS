import { z } from "zod";

import { journalEntrySchema } from "../../db/schemas/domain-records";
import { calendarDaySchema } from "../../lib/dates/date-values";

export { journalEntrySchema };
export type JournalEntry = z.infer<typeof journalEntrySchema>;

const scaleSchema = z.int().min(1).max(5);
const reflectionText = z.string().trim().max(50_000);

export const journalEntryDetailsSchema = z
  .object({
    localDate: calendarDaySchema,
    mood: scaleSchema.optional(),
    energy: scaleSchema.optional(),
    stress: scaleSchema.optional(),
    productivity: scaleSchema.optional(),
    highlight: reflectionText.optional(),
    improvement: reflectionText.optional(),
    gratitude: reflectionText.optional(),
    body: reflectionText.optional(),
  })
  .strict();

export type JournalEntryDetails = z.infer<typeof journalEntryDetailsSchema>;
export type JournalScaleKey = "energy" | "mood" | "productivity" | "stress";
export type JournalTextKey = "body" | "gratitude" | "highlight" | "improvement";

export const journalScaleKeys: JournalScaleKey[] = [
  "mood",
  "energy",
  "stress",
  "productivity",
];

export const journalTextKeys: JournalTextKey[] = [
  "highlight",
  "improvement",
  "gratitude",
  "body",
];

/**
 * Neutrale Beschriftungen: Die Skalen beschreiben eine Selbsteinschätzung und
 * bewerten sie nicht. Ein ausgelassener Wert ist keine Null.
 */
export const journalScaleLabels: Record<JournalScaleKey, string> = {
  energy: "Energie",
  mood: "Stimmung",
  productivity: "Produktivität",
  stress: "Stress",
};

export const journalScaleHints: Record<JournalScaleKey, string> = {
  energy: "1 bedeutet sehr wenig Energie, 5 bedeutet sehr viel Energie.",
  mood: "1 bedeutet sehr gedrückt, 5 bedeutet sehr gut.",
  productivity:
    "Subjektive Einschätzung. 1 bedeutet sehr wenig, 5 bedeutet sehr viel.",
  stress: "1 bedeutet sehr wenig Stress, 5 bedeutet sehr viel Stress.",
};

export const journalTextLabels: Record<JournalTextKey, string> = {
  body: "Freitext",
  gratitude: "Wofür bist du dankbar?",
  highlight: "Highlight des Tages",
  improvement: "Was möchtest du anders machen?",
};

export const journalScaleValues = [1, 2, 3, 4, 5] as const;

export function hasJournalContent(details: JournalEntryDetails): boolean {
  return [...journalScaleKeys, ...journalTextKeys].some(
    (key) => details[key] !== undefined,
  );
}
