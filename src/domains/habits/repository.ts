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

export type HabitEntryRepository = {
  clearForDate(habitId: string, localDate: CalendarDay): Promise<boolean>;
  getForDate(
    habitId: string,
    localDate: CalendarDay,
  ): Promise<HabitEntry | undefined>;
  listForHabit(
    habitId: string,
    range?: { from?: CalendarDay; to?: CalendarDay },
  ): Promise<HabitEntry[]>;
  setForDate(details: HabitEntryDetails): Promise<HabitEntry>;
};

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
    async listForHabit(habitId, range = {}) {
      try {
        const validHabitId = parse(entityIdSchema, habitId);
        const from = range.from
          ? parse(calendarDaySchema, range.from)
          : undefined;
        const to = range.to ? parse(calendarDaySchema, range.to) : undefined;
        if (from && to && from > to) {
          throw new PersistenceError("validation");
        }
        const entries = await database
          .table<HabitEntry>("habitEntries")
          .where("habitId")
          .equals(validHabitId)
          .sortBy("localDate");
        return entries
          .map((entry) => parse(habitEntrySchema, entry))
          .filter(
            (entry) =>
              entry.archivedAt === undefined &&
              (from === undefined || entry.localDate >= from) &&
              (to === undefined || entry.localDate <= to),
          );
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
