import { z } from "zod";

import { personalOsDatabase, type PersonalOsDatabase } from "../../db/database";
import { PersistenceError, toPersistenceError } from "../../db/errors";
import type { ListOptions, Repository } from "../../db/repositories/contracts";
import { DexieRepository } from "../../db/repositories/dexie-repository";
import type { EntityMeta, EntityMetadataDependencies } from "../../db/types";
import {
  calendarDaySchema,
  type CalendarDay,
} from "../../lib/dates/date-values";
import { entityIdSchema } from "../../lib/identifiers/entity-id";
import { sortContributions } from "./savings";
import {
  financeCategoryDetailsSchema,
  financeCategorySchema,
  monthlyBudgetDetailsSchema,
  monthlyBudgetSchema,
  recurringTransactionDetailsSchema,
  recurringTransactionSchema,
  savingsContributionDetailsSchema,
  savingsContributionSchema,
  savingsGoalDetailsSchema,
  savingsGoalSchema,
  transactionDetailsSchema,
  transactionSchema,
  type FinanceCategory,
  type FinanceCategoryDetails,
  type FinanceKind,
  type MonthlyBudget,
  type MonthlyBudgetDetails,
  type RecurringTransaction,
  type RecurringTransactionDetails,
  type SavingsContribution,
  type SavingsContributionDetails,
  type SavingsGoal,
  type SavingsGoalDetails,
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

  /*
   * Ein Monat über den Index auf `bookedOn`. `YYYY-MM-DD` sortiert
   * lexikografisch wie chronologisch, deshalb umschließt der erste bis
   * einunddreißigste Tag jeden Tag des Monats. Vorher las jede Monatsansicht
   * die vollständige Buchungshistorie und warf den Rest weg.
   */
  const listForMonth = async (month: string): Promise<Transaction[]> => {
    try {
      const rows = await database
        .table<Transaction>("transactions")
        .where("bookedOn")
        .between(`${month}-01`, `${month}-31`, true, true)
        .reverse()
        .sortBy("bookedOn");
      return rows.map((row) => parse(transactionSchema, row));
    } catch (error) {
      throw toPersistenceError(error);
    }
  };

  return Object.assign(records, {
    async countForCategory(categoryId: string) {
      const validCategoryId = parse(entityIdSchema, categoryId);
      try {
        const rows = await database
          .table<Transaction>("transactions")
          .where("categoryId")
          .equals(validCategoryId)
          .toArray();
        return rows.filter((row) => row.archivedAt === undefined).length;
      } catch (error) {
        throw toPersistenceError(error);
      }
    },
    async listFiltered(filter: TransactionFilter = {}) {
      const month = filter.month
        ? parse(calendarMonthOnly, filter.month)
        : undefined;
      const categoryId = filter.categoryId
        ? parse(entityIdSchema, filter.categoryId)
        : undefined;
      const rows =
        month === undefined ? await listAll() : await listForMonth(month);

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

export type MonthlyBudgetRepository = Repository<
  MonthlyBudget,
  MonthlyBudgetDetails
> & {
  listForMonth(month: string): Promise<MonthlyBudget[]>;
};

export function createMonthlyBudgetRepository(
  database: PersonalOsDatabase,
  dependencies: EntityMetadataDependencies = {},
): MonthlyBudgetRepository {
  const records = new DexieRepository<MonthlyBudget, MonthlyBudgetDetails>({
    clock: dependencies.clock,
    createEntity: (input: MonthlyBudgetDetails, metadata: EntityMeta) => ({
      ...metadata,
      ...input,
    }),
    createSchema: monthlyBudgetDetailsSchema,
    database,
    entitySchema: monthlyBudgetSchema,
    idGenerator: dependencies.idGenerator,
    tableName: "monthlyBudgets",
  });

  return Object.assign(records, {
    async listForMonth(month: string) {
      try {
        const validMonth = parse(calendarMonthOnly, month);
        const rows = await database
          .table<MonthlyBudget>("monthlyBudgets")
          .where("month")
          .equals(validMonth)
          .toArray();
        return rows.map((row) => parse(monthlyBudgetSchema, row));
      } catch (error) {
        throw toPersistenceError(error);
      }
    },
  });
}

export type SavingsGoalRepository = Repository<SavingsGoal, SavingsGoalDetails>;

export type SavingsContributionRepository = Repository<
  SavingsContribution,
  SavingsContributionDetails
> & {
  listForGoal(
    savingsGoalId: string,
    options?: ListOptions,
  ): Promise<SavingsContribution[]>;
};

export function createSavingsGoalRepository(
  database: PersonalOsDatabase,
  dependencies: EntityMetadataDependencies = {},
): SavingsGoalRepository {
  return new DexieRepository<SavingsGoal, SavingsGoalDetails>({
    clock: dependencies.clock,
    createEntity: (input: SavingsGoalDetails, metadata: EntityMeta) => ({
      ...metadata,
      ...input,
    }),
    createSchema: savingsGoalDetailsSchema,
    database,
    entitySchema: savingsGoalSchema,
    idGenerator: dependencies.idGenerator,
    tableName: "savingsGoals",
  });
}

export function createSavingsContributionRepository(
  database: PersonalOsDatabase,
  dependencies: EntityMetadataDependencies = {},
): SavingsContributionRepository {
  const records = new DexieRepository<
    SavingsContribution,
    SavingsContributionDetails
  >({
    clock: dependencies.clock,
    createEntity: (
      input: SavingsContributionDetails,
      metadata: EntityMeta,
    ) => ({
      ...metadata,
      ...input,
    }),
    createSchema: savingsContributionDetailsSchema,
    database,
    entitySchema: savingsContributionSchema,
    idGenerator: dependencies.idGenerator,
    tableName: "savingsContributions",
  });

  return Object.assign(records, {
    async listForGoal(savingsGoalId: string, options: ListOptions = {}) {
      try {
        const validId = parse(entityIdSchema, savingsGoalId);
        const rows = await database
          .table<SavingsContribution>("savingsContributions")
          .where("savingsGoalId")
          .equals(validId)
          .toArray();
        const parsed = rows.map((row) => parse(savingsContributionSchema, row));
        return sortContributions(
          options.includeArchived
            ? parsed
            : parsed.filter((row) => row.archivedAt === undefined),
        );
      } catch (error) {
        throw toPersistenceError(error);
      }
    },
  });
}

export type RecurringTransactionRepository = Repository<
  RecurringTransaction,
  RecurringTransactionDetails
>;

/**
 * Vorlagen sind gewöhnliche Datensätze; alle Besonderheiten stecken in der
 * Auswertung (`recurring.ts`) und nicht in der Ablage. Siehe
 * [ADR 0013](../../../docs/decisions/0013-recurring-transactions-are-confirmed-templates.md).
 */
export function createRecurringTransactionRepository(
  database: PersonalOsDatabase,
  dependencies: EntityMetadataDependencies = {},
): RecurringTransactionRepository {
  return new DexieRepository<RecurringTransaction, RecurringTransactionDetails>(
    {
      clock: dependencies.clock,
      createEntity: (
        input: RecurringTransactionDetails,
        metadata: EntityMeta,
      ) => ({
        ...metadata,
        ...input,
      }),
      createSchema: recurringTransactionDetailsSchema,
      database,
      entitySchema: recurringTransactionSchema,
      idGenerator: dependencies.idGenerator,
      tableName: "recurringTransactions",
    },
  );
}

export const personalOsFinanceCategoryRepository =
  createFinanceCategoryRepository(personalOsDatabase);
export const personalOsRecurringTransactionRepository =
  createRecurringTransactionRepository(personalOsDatabase);
export const personalOsSavingsContributionRepository =
  createSavingsContributionRepository(personalOsDatabase);
export const personalOsSavingsGoalRepository =
  createSavingsGoalRepository(personalOsDatabase);
export const personalOsMonthlyBudgetRepository =
  createMonthlyBudgetRepository(personalOsDatabase);
export const personalOsTransactionRepository =
  createTransactionRepository(personalOsDatabase);
