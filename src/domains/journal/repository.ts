import { z } from "zod";

import { personalOsDatabase, type PersonalOsDatabase } from "../../db/database";
import { PersistenceError, toPersistenceError } from "../../db/errors";
import { DexieRepository } from "../../db/repositories/dexie-repository";
import { runInTransaction } from "../../db/transactions";
import type { EntityMeta, EntityMetadataDependencies } from "../../db/types";
import {
  calendarDaySchema,
  type CalendarDay,
} from "../../lib/dates/date-values";
import {
  journalEntryDetailsSchema,
  journalEntrySchema,
  type JournalEntry,
  type JournalEntryDetails,
} from "./model";

export type JournalRepository = {
  getForDate(localDate: CalendarDay): Promise<JournalEntry | undefined>;
  list(range?: {
    from?: CalendarDay;
    to?: CalendarDay;
  }): Promise<JournalEntry[]>;
  saveForDate(details: JournalEntryDetails): Promise<JournalEntry>;
};

export function createJournalRepository(
  database: PersonalOsDatabase,
  dependencies: EntityMetadataDependencies = {},
): JournalRepository {
  const records = new DexieRepository<JournalEntry, JournalEntryDetails>({
    clock: dependencies.clock,
    createEntity: (input: JournalEntryDetails, metadata: EntityMeta) => ({
      ...metadata,
      ...input,
    }),
    createSchema: journalEntryDetailsSchema,
    database,
    entitySchema: journalEntrySchema,
    idGenerator: dependencies.idGenerator,
    tableName: "journalEntries",
  });

  const getForDate = async (
    localDate: CalendarDay,
  ): Promise<JournalEntry | undefined> => {
    try {
      const validDate = parse(calendarDaySchema, localDate);
      const entry = await database
        .table<JournalEntry>("journalEntries")
        .where("localDate")
        .equals(validDate)
        .first();
      return entry === undefined ? undefined : parse(journalEntrySchema, entry);
    } catch (error) {
      throw toPersistenceError(error);
    }
  };

  return {
    getForDate,
    async list(range = {}) {
      try {
        const from = range.from
          ? parse(calendarDaySchema, range.from)
          : undefined;
        const to = range.to ? parse(calendarDaySchema, range.to) : undefined;
        if (from && to && from > to) {
          throw new PersistenceError("validation");
        }
        /*
         * Der Zeitraum steht im Index auf `localDate`. Vorher las jede
         * Wochen- und Monatsauswertung die vollständige Journalhistorie und
         * warf den Rest anschließend weg.
         */
        const table = database.table<JournalEntry>("journalEntries");
        const entries =
          from === undefined && to === undefined
            ? await table.orderBy("localDate").reverse().toArray()
            : await table
                .where("localDate")
                .between(from ?? "0000-01-01", to ?? "9999-12-31", true, true)
                .reverse()
                .sortBy("localDate");
        return entries
          .map((entry) => parse(journalEntrySchema, entry))
          .filter((entry) => entry.archivedAt === undefined);
      } catch (error) {
        throw toPersistenceError(error);
      }
    },
    async saveForDate(details) {
      const validDetails = parse(journalEntryDetailsSchema, details);
      return runInTransaction(database, ["journalEntries"], async () => {
        const current = await getForDate(validDetails.localDate);
        if (current === undefined) return records.create(validDetails);
        // Der Tag eines vorhandenen Eintrags bleibt unverändert; er ist der
        // fachliche Schlüssel.
        return records.update(current.id, {
          body: validDetails.body,
          energy: validDetails.energy,
          gratitude: validDetails.gratitude,
          highlight: validDetails.highlight,
          improvement: validDetails.improvement,
          mood: validDetails.mood,
          productivity: validDetails.productivity,
          stress: validDetails.stress,
        });
      });
    },
  };
}

function parse<TValue>(schema: z.ZodType<TValue>, value: unknown): TValue {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new PersistenceError("validation", { cause: result.error });
  }
  return result.data;
}

export const personalOsJournalRepository =
  createJournalRepository(personalOsDatabase);
