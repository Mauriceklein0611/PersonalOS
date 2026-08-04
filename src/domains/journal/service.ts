import { PersistenceError } from "../../db/errors";
import type { CalendarDay } from "../../lib/dates/date-values";
import {
  hasJournalContent,
  journalTextKeys,
  type JournalEntry,
  type JournalEntryDetails,
} from "./model";
import {
  personalOsJournalRepository,
  type JournalRepository,
} from "./repository";

export interface JournalService {
  getForDate(localDate: CalendarDay): Promise<JournalEntry | undefined>;
  list(range?: {
    from?: CalendarDay;
    to?: CalendarDay;
  }): Promise<JournalEntry[]>;
  saveForDate(details: JournalEntryDetails): Promise<JournalEntry>;
}

export function createJournalService(
  entries: JournalRepository,
): JournalService {
  /**
   * Leere Texte werden entfernt statt als leerer String gespeichert. Ein
   * ausgelassenes Feld bleibt dadurch `undefined` und wird nirgends als Wert
   * interpretiert.
   */
  const normalizeDetails = (details: JournalEntryDetails) => {
    const normalized = { ...details };
    for (const key of journalTextKeys) {
      normalized[key] = normalized[key]?.trim() || undefined;
    }
    return normalized;
  };

  return {
    getForDate: (localDate) => entries.getForDate(localDate),
    list: (range) => entries.list(range),
    async saveForDate(details) {
      const normalized = normalizeDetails(details);
      if (!hasJournalContent(normalized)) {
        throw new PersistenceError("validation");
      }
      return entries.saveForDate(normalized);
    },
  };
}

export const personalOsJournalService = createJournalService(
  personalOsJournalRepository,
);
