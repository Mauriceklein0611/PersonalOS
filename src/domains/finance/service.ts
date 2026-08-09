import {
  createMoney,
  subtractMoney,
  sumMoney,
  type Money,
} from "../../lib/money/money";
import type { CalendarDay } from "../../lib/dates/date-values";
import { findBudget } from "./budget";
import type {
  FinanceCategory,
  FinanceCategoryDetails,
  FinanceKind,
  MonthlyBudget,
  MonthlyBudgetDetails,
  RecurringTransaction,
  RecurringTransactionDetails,
  Transaction,
  TransactionDetails,
} from "./model";
import {
  buildTransactionFromTemplate,
  listDueRecurringTransactions,
  monthOfCalendarDay,
  type DueRecurringTransaction,
} from "./recurring";
import {
  personalOsFinanceCategoryRepository,
  personalOsMonthlyBudgetRepository,
  personalOsRecurringTransactionRepository,
  personalOsTransactionRepository,
  type FinanceCategoryRepository,
  type MonthlyBudgetRepository,
  type RecurringTransactionRepository,
  type TransactionFilter,
  type TransactionRepository,
} from "./repository";

/**
 * Eine Kategorie mit Buchungen wird archiviert statt gelöscht, damit keine
 * Referenz bricht. Der Aufrufer erfährt, was tatsächlich passiert ist.
 */
export type CategoryRemoval =
  | { kind: "archived"; category: FinanceCategory; usageCount: number }
  | { kind: "deleted"; categoryId: string };

export type MonthlyTotals = {
  balanceMinor: number;
  currency: string;
  expense: Money;
  income: Money;
};

export type FinanceService = {
  archiveCategory(id: string): Promise<FinanceCategory>;
  archiveRecurringTransaction(id: string): Promise<RecurringTransaction>;
  /** Schreibt die Buchung einer Vorlage — nur auf ausdrückliche Bestätigung. */
  confirmRecurringTransaction(
    due: DueRecurringTransaction,
  ): Promise<Transaction>;
  createRecurringTransaction(
    details: RecurringTransactionDetails,
  ): Promise<RecurringTransaction>;
  /** Die im Monat des Stichtags offenen Vorlagen. Reines Lesen. */
  listDueRecurringTransactions(
    today: CalendarDay,
  ): Promise<DueRecurringTransaction[]>;
  listRecurringTransactions(options?: {
    includeArchived?: boolean;
  }): Promise<RecurringTransaction[]>;
  updateRecurringTransaction(
    id: string,
    patch: Partial<RecurringTransactionDetails>,
  ): Promise<RecurringTransaction>;
  listBudgets(month: string): Promise<MonthlyBudget[]>;
  /**
   * Entfernt endgültig. Der eindeutige Index über Monat und Kategorie gilt
   * datenbankweit; ein archivierter Datensatz würde die Kombination dauerhaft
   * blockieren. Die Historie liegt ohnehin in den Buchungen, nicht im Budget.
   */
  removeBudget(id: string): Promise<void>;
  /** Legt an oder aktualisiert; pro Monat und Kategorie bleibt es eines. */
  setBudget(details: MonthlyBudgetDetails): Promise<MonthlyBudget>;
  archiveTransaction(id: string): Promise<Transaction>;
  createCategory(details: FinanceCategoryDetails): Promise<FinanceCategory>;
  createTransaction(details: TransactionDetails): Promise<Transaction>;
  listCategories(options?: {
    includeArchived?: boolean;
  }): Promise<FinanceCategory[]>;
  listTransactions(filter?: TransactionFilter): Promise<Transaction[]>;
  removeCategory(id: string): Promise<CategoryRemoval>;
  restoreCategory(id: string): Promise<FinanceCategory>;
  restoreTransaction(id: string): Promise<Transaction>;
  updateCategory(
    id: string,
    patch: Partial<FinanceCategoryDetails>,
  ): Promise<FinanceCategory>;
  updateTransaction(
    id: string,
    patch: Partial<TransactionDetails>,
  ): Promise<Transaction>;
};

export function createFinanceService(
  categories: FinanceCategoryRepository = personalOsFinanceCategoryRepository,
  transactions: TransactionRepository = personalOsTransactionRepository,
  budgets: MonthlyBudgetRepository = personalOsMonthlyBudgetRepository,
  recurring: RecurringTransactionRepository = personalOsRecurringTransactionRepository,
): FinanceService {
  return {
    archiveRecurringTransaction: (id) => recurring.archive(id),
    createRecurringTransaction: (details) => recurring.create(details),
    listRecurringTransactions: (options) => recurring.list(options),
    updateRecurringTransaction: (id, patch) => recurring.update(id, patch),
    /**
     * Die **einzige** Stelle, an der aus einer Vorlage eine Buchung entsteht,
     * und sie läuft nur auf ausdrückliche Bestätigung. Es gibt keinen Pfad,
     * der das im Hintergrund tut. Siehe
     * [ADR 0013](../../../docs/decisions/0013-recurring-transactions-are-confirmed-templates.md).
     */
    async confirmRecurringTransaction(due) {
      return transactions.create(buildTransactionFromTemplate(due));
    },
    async listDueRecurringTransactions(today) {
      const [templates, booked] = await Promise.all([
        recurring.list(),
        transactions.listFiltered({ month: monthOfCalendarDay(today) }),
      ]);
      return listDueRecurringTransactions(templates, booked, today);
    },
    archiveCategory: (id) => categories.archive(id),
    listBudgets: (month) => budgets.listForMonth(month),
    removeBudget: (id) => budgets.deletePermanently(id),
    async setBudget(details) {
      const existing = await budgets.listForMonth(details.month);
      const current = findBudget(existing, details.month, details.categoryId);
      // Ein zweites aktives Budget für dieselbe Kombination entsteht nie.
      return current === undefined
        ? budgets.create(details)
        : budgets.update(current.id, { limit: details.limit });
    },
    archiveTransaction: (id) => transactions.archive(id),
    createCategory: (details) => categories.create(details),
    createTransaction: (details) => transactions.create(details),
    listCategories: (options) => categories.list(options),
    listTransactions: (filter) => transactions.listFiltered(filter),
    async removeCategory(id) {
      const usageCount = await transactions.countForCategory(id);
      if (usageCount > 0) {
        const category = await categories.archive(id);
        return { category, kind: "archived", usageCount };
      }

      await categories.deletePermanently(id);
      return { categoryId: id, kind: "deleted" };
    },
    restoreCategory: (id) => categories.restore(id),
    restoreTransaction: (id) => transactions.restore(id),
    updateCategory: (id, patch) => categories.update(id, patch),
    updateTransaction: (id, patch) => transactions.update(id, patch),
  };
}

/**
 * Summiert je Richtung getrennt. Der Saldo bleibt eine ganzzahlige Differenz
 * in Minor Units und wird nie als Gleitkommazahl gerechnet.
 */
export function calculateTotals(
  transactions: readonly Transaction[],
  currency: string,
): MonthlyTotals {
  const byKind = (kind: FinanceKind) =>
    transactions
      .filter((transaction) => transaction.kind === kind)
      .map((transaction) => transaction.money);

  const income = sumMoney(byKind("income"), currency);
  const expense = sumMoney(byKind("expense"), currency);

  return {
    balanceMinor: subtractMoney(income, expense),
    currency,
    expense,
    income,
  };
}

export function sumByCategory(
  transactions: readonly Transaction[],
  currency: string,
): Map<string, Money> {
  const totals = new Map<string, Money>();
  for (const transaction of transactions) {
    const current =
      totals.get(transaction.categoryId) ?? createMoney(0, currency);
    totals.set(
      transaction.categoryId,
      sumMoney([current, transaction.money], currency),
    );
  }
  return totals;
}

export const personalOsFinanceService = createFinanceService();
