import { z } from "zod";

import { personalOsDatabase, type PersonalOsDatabase } from "../../db/database";
import { PersistenceError, toPersistenceError } from "../../db/errors";
import type { Repository } from "../../db/repositories/contracts";
import { DexieRepository } from "../../db/repositories/dexie-repository";
import { runInTransaction } from "../../db/transactions";
import type { EntityMeta, EntityMetadataDependencies } from "../../db/types";
import {
  calendarDaySchema,
  type CalendarDay,
} from "../../lib/dates/date-values";
import { entityIdSchema } from "../../lib/identifiers/entity-id";
import {
  habitDetailsSchema,
  habitEntryDetailsSchema,
  habitEntrySchema,
  habitSchema,
  type Habit,
  type HabitDetails,
  type HabitEntry,
  type HabitEntryDetails,
} from "./model";

export type HabitRepository = Repository<Habit, HabitDetails>;

export type HabitEntryRange = { from?: CalendarDay; to?: CalendarDay };

export type HabitEntryRepository = {
  clearForDate(habitId: string, localDate: CalendarDay): Promise<boolean>;
  getForDate(
    habitId: string,
    localDate: CalendarDay,
  ): Promise<HabitEntry | undefined>;
  listForHabit(habitId: string, range?: HabitEntryRange): Promise<HabitEntry[]>;
  /** Alle Routinen auf einmal; die Zuordnung übernimmt der Aufrufer. */
  listInRange(range?: HabitEntryRange): Promise<HabitEntry[]>;
  setForDate(details: HabitEntryDetails): Promise<HabitEntry>;
};

/**
 * Die Grenzen eines Kalendertages als Zeichenkette. `YYYY-MM-DD` sortiert
 * lexikografisch wie chronologisch; damit deckt der Bereich jeden gültigen
 * Wert ab, wenn nur eine Seite angegeben ist.
 */
const minimumCalendarDay = "0000-01-01";
const maximumCalendarDay = "9999-12-31";

export function createHabitRepository(
  database: PersonalOsDatabase,
  dependencies: EntityMetadataDependencies = {},
): HabitRepository {
  return new DexieRepository<Habit, HabitDetails>({
    clock: dependencies.clock,
    createEntity: (input: HabitDetails, metadata: EntityMeta) => ({
      ...metadata,
      ...input,
    }),
    createSchema: habitDetailsSchema,
    database,
    entitySchema: habitSchema,
    idGenerator: dependencies.idGenerator,
    tableName: "habits",
  });
}

export function createHabitEntryRepository(
  database: PersonalOsDatabase,
  dependencies: EntityMetadataDependencies = {},
): HabitEntryRepository {
  const records = new DexieRepository<HabitEntry, HabitEntryDetails>({
    clock: dependencies.clock,
    createEntity: (input: HabitEntryDetails, metadata: EntityMeta) => ({
      ...metadata,
      ...input,
    }),
    createSchema: habitEntryDetailsSchema,
    database,
    entitySchema: habitEntrySchema,
    idGenerator: dependencies.idGenerator,
    tableName: "habitEntries",
  });

  const getForDate = async (
    habitId: string,
    localDate: CalendarDay,
  ): Promise<HabitEntry | undefined> => {
    try {
      const validHabitId = parse(entityIdSchema, habitId);
      const validDate = parse(calendarDaySchema, localDate);
      const entry = await database
        .table<HabitEntry>("habitEntries")
        .where("[habitId+localDate]")
        .equals([validHabitId, validDate])
        .first();
      return entry === undefined ? undefined : parse(habitEntrySchema, entry);
    } catch (error) {
      throw toPersistenceError(error);
    }
  };

  return {
    async clearForDate(habitId, localDate) {
      return runInTransaction(database, ["habitEntries"], async () => {
        const current = await getForDate(habitId, localDate);
        if (current === undefined) return false;
        await records.deletePermanently(current.id);
        return true;
      });
    },
    getForDate,
    /*
     * Der zusammengesetzte Index `[habitId+localDate]` grenzt den Zeitraum
     * bereits in der Datenbank ein. Vorher las die Abfrage die gesamte
     * Historie einer Routine und warf sie anschließend in JavaScript weg: Für
     * sieben Tage nach drei Jahren Nutzung waren das rund 1.000 gelesene
     * Datensätze statt sieben.
     */
    async listForHabit(habitId, range = {}) {
      try {
        const validHabitId = parse(entityIdSchema, habitId);
        const { from, to } = validRange(range);
        const table = database.table<HabitEntry>("habitEntries");
        const entries =
          from === undefined && to === undefined
            ? await table
                .where("habitId")
                .equals(validHabitId)
                .sortBy("localDate")
            : await table
                .where("[habitId+localDate]")
                .between(
                  [validHabitId, from ?? minimumCalendarDay],
                  [validHabitId, to ?? maximumCalendarDay],
                  true,
                  true,
                )
                .sortBy("localDate");
        return entries
          .map((entry) => parse(habitEntrySchema, entry))
          .filter((entry) => entry.archivedAt === undefined);
      } catch (error) {
        throw toPersistenceError(error);
      }
    },
    /*
     * Ein Zeitraum über **alle** Routinen. Die Tagesübersicht und die
     * Routinenseite fragten vorher je Routine einzeln nach; bei 40 Routinen
     * waren das 40 Abfragen für eine Ansicht. Der Index auf `localDate`
     * beantwortet dieselbe Frage mit einer.
     */
    async listInRange(range = {}) {
      try {
        const { from, to } = validRange(range);
        const table = database.table<HabitEntry>("habitEntries");
        const entries =
          from === undefined && to === undefined
            ? await table.toArray()
            : await table
                .where("localDate")
                .between(
                  from ?? minimumCalendarDay,
                  to ?? maximumCalendarDay,
                  true,
                  true,
                )
                .toArray();
        return entries
          .map((entry) => parse(habitEntrySchema, entry))
          .filter((entry) => entry.archivedAt === undefined);
      } catch (error) {
        throw toPersistenceError(error);
      }
    },
    async setForDate(details) {
      const validDetails = parse(habitEntryDetailsSchema, details);
      return runInTransaction(database, ["habitEntries"], async () => {
        const current = await getForDate(
          validDetails.habitId,
          validDetails.localDate,
        );
        return current === undefined
          ? records.create(validDetails)
          : records.update(current.id, {
              note: validDetails.note,
              status: validDetails.status,
            });
      });
    },
  };
}

/** Prüft beide Grenzen und weist einen umgekehrten Zeitraum ab. */
function validRange(range: HabitEntryRange): {
  from?: CalendarDay;
  to?: CalendarDay;
} {
  const from = range.from ? parse(calendarDaySchema, range.from) : undefined;
  const to = range.to ? parse(calendarDaySchema, range.to) : undefined;
  if (from && to && from > to) {
    throw new PersistenceError("validation");
  }
  return { from, to };
}

function parse<TValue>(schema: z.ZodType<TValue>, value: unknown): TValue {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new PersistenceError("validation", { cause: result.error });
  }
  return result.data;
}

export const personalOsHabitRepository =
  createHabitRepository(personalOsDatabase);
export const personalOsHabitEntryRepository =
  createHabitEntryRepository(personalOsDatabase);
