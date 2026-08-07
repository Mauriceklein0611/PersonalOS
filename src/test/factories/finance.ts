import type {
  FinanceCategory,
  FinanceCategoryDetails,
  MonthlyBudget,
  Transaction,
  TransactionDetails,
} from "../../domains/finance/model";
import type { TransactionFilter } from "../../domains/finance/repository";
import type {
  CategoryRemoval,
  FinanceService,
} from "../../domains/finance/service";

/** Kleiner In-Memory-Ersatz; die Persistenz ist im Repository-Test abgedeckt. */
export function createMemoryFinanceService(): FinanceService {
  const categories: FinanceCategory[] = [];
  const transactions: Transaction[] = [];
  let sequence = 0;

  const nextId = () =>
    `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
  const meta = () => ({
    createdAt: "2026-08-04T08:00:00.000Z",
    id: nextId(),
    updatedAt: "2026-08-04T08:00:00.000Z",
  });

  const budgets: MonthlyBudget[] = [];

  return {
    archiveCategory: async (id) => requireCategory(id),
    listBudgets: async (month) =>
      budgets.filter((budget) => budget.month === month),
    removeBudget: async (id) => {
      const index = budgets.findIndex((row) => row.id === id);
      if (index >= 0) budgets.splice(index, 1);
    },
    setBudget: async (details) => {
      const current = budgets.find(
        (budget) =>
          budget.archivedAt === undefined &&
          budget.month === details.month &&
          budget.categoryId === details.categoryId,
      );
      if (current) {
        current.limit = details.limit;
        return current;
      }
      const budget = { ...meta(), ...details } as MonthlyBudget;
      budgets.push(budget);
      return budget;
    },
    archiveTransaction: async (id) => {
      const entry = transactions.find((row) => row.id === id);
      if (!entry) throw new Error("unknown transaction");
      entry.archivedAt = "2026-08-04T09:00:00.000Z";
      return entry;
    },
    createCategory: async (details: FinanceCategoryDetails) => {
      const category = { ...meta(), ...details } as FinanceCategory;
      categories.push(category);
      return category;
    },
    createTransaction: async (details: TransactionDetails) => {
      const transaction = { ...meta(), ...details } as Transaction;
      transactions.push(transaction);
      return transaction;
    },
    listCategories: async () =>
      categories.filter((category) => category.archivedAt === undefined),
    listTransactions: async (filter: TransactionFilter = {}) =>
      transactions.filter(
        (entry) =>
          entry.archivedAt === undefined &&
          (filter.kind === undefined || entry.kind === filter.kind),
      ),
    removeCategory: async (id): Promise<CategoryRemoval> => {
      const category = requireCategorySync(id);
      const usageCount = transactions.filter(
        (entry) => entry.categoryId === id && entry.archivedAt === undefined,
      ).length;
      if (usageCount > 0) {
        category.archivedAt = "2026-08-04T09:00:00.000Z";
        return { category, kind: "archived", usageCount };
      }
      categories.splice(categories.indexOf(category), 1);
      return { categoryId: id, kind: "deleted" };
    },
    restoreCategory: async (id) => requireCategory(id),
    restoreTransaction: async (id) => {
      const entry = transactions.find((row) => row.id === id);
      if (!entry) throw new Error("unknown transaction");
      delete entry.archivedAt;
      return entry;
    },
    updateCategory: async (id) => requireCategory(id),
    updateTransaction: async (id) => {
      const entry = transactions.find((row) => row.id === id);
      if (!entry) throw new Error("unknown transaction");
      return entry;
    },
  };

  function requireCategorySync(id: string): FinanceCategory {
    const category = categories.find((row) => row.id === id);
    if (!category) throw new Error("unknown category");
    return category;
  }

  async function requireCategory(id: string): Promise<FinanceCategory> {
    return requireCategorySync(id);
  }
}
