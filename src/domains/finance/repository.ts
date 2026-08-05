import { z } from "zod";

import { personalOsDatabase, type PersonalOsDatabase } from "../../db/database";
import { PersistenceError, toPersistenceError } from "../../db/errors";
import type { Repository } from "../../db/repositories/contracts";
import { DexieRepository } from "../../db/repositories/dexie-repository";
import type { EntityMeta, EntityMetadataDependencies } from "../../db/types";
import {
  calendarDaySchema,
  type CalendarDay,
} from "../../lib/dates/date-values";
import { entityIdSchema } from "../../lib/identifiers/entity-id";
import {
  financeCategoryDetailsSchema,
  financeCategorySchema,
  transactionDetailsSchema,
  transactionSchema,
  type FinanceCategory,
  type FinanceCategoryDetails,
  type FinanceKind,
  type Transaction,
  type TransactionDetails,
} from "./model";

export type FinanceCategoryRepository = Repository<
  FinanceCategory,
  FinanceCategoryDetails
>;

export type TransactionFilter = {
  categoryId?: string;
  /** Kalendermonat als `YYYY-MM`. */
  month?: string;
  kind?: FinanceKind;
};

export type TransactionRepository = Repository<
  Transaction,
  TransactionDetails
> & {
  countForCategory(categoryId: string): Promise<number>;
  listFiltered(filter?: TransactionFilter): Promise<Transaction[]>;
};

export function createFinanceCategoryRepository(
  database: PersonalOsDatabase,
  dependencies: EntityMetadataDependencies = {},
): FinanceCategoryRepository {
  return new DexieRepository<FinanceCategory, FinanceCategoryDetails>({
    clock: dependencies.clock,
    createEntity: (input: FinanceCategoryDetails, metadata: EntityMeta) => ({
      ...metadata,
      ...input,
    }),
    createSchema: financeCategoryDetailsSchema,
    database,
    entitySchema: financeCategorySchema,
    idGenerator: dependencies.idGenerator,
    tableName: "financeCategories",
  });
}

export function createTransactionRepository(
  database: PersonalOsDatabase,
  dependencies: EntityMetadataDependencies = {},
): TransactionRepository {
  const records = new DexieRepository<Transaction, TransactionDetails>({
    clock: dependencies.clock,
    createEntity: (input: TransactionDetails, metadata: EntityMeta) => ({
      ...metadata,
      ...input,
    }),
    createSchema: transactionDetailsSchema,
    database,
    entitySchema: transactionSchema,
    idGenerator: dependencies.idGenerator,
    tableName: "transactions",
  });

  const listAll = async (): Promise<Transaction[]> => {
    try {
      const rows = await database
        .table<Transaction>("transactions")
        .orderBy("bookedOn")
        .reverse()
        .toArray();
      return rows.map((row) => parse(transactionSchema, row));
    } catch (error) {
      throw toPersistenceError(error);
    }
  };

  return Object.assign(records, {
    async countForCategory(categoryId: string) {
      const validCategoryId = parse(entityIdSchema, categoryId);
      const rows = await listAll();
      return rows.filter(
        (row) =>
          row.categoryId === validCategoryId && row.archivedAt === undefined,
      ).length;
    },
    async listFiltered(filter: TransactionFilter = {}) {
      const month = filter.month
        ? parse(calendarMonthOnly, filter.month)
        : undefined;
      const categoryId = filter.categoryId
        ? parse(entityIdSchema, filter.categoryId)
        : undefined;
      const rows = await listAll();

      return rows.filter((row) => {
        if (row.archivedAt !== undefined) return false;
        if (categoryId !== undefined && row.categoryId !== categoryId)
          return false;
        if (filter.kind !== undefined && row.kind !== filter.kind) return false;
        if (month !== undefined && monthOf(row.bookedOn) !== month)
          return false;
        return true;
      });
    },
  });
}

const calendarMonthOnly = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export function monthOf(day: CalendarDay): string {
  return parse(calendarDaySchema, day).slice(0, 7);
}

function parse<TValue>(schema: z.ZodType<TValue>, value: unknown): TValue {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new PersistenceError("validation", { cause: result.error });
  }
  return result.data;
}

export const personalOsFinanceCategoryRepository =
  createFinanceCategoryRepository(personalOsDatabase);
export const personalOsTransactionRepository =
  createTransactionRepository(personalOsDatabase);
