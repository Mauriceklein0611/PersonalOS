import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PersonalOsDatabase } from "../../db/database";
import { createTestDatabase, deleteTestDatabase } from "../../test/database";
import type { Transaction } from "./model";
import {
  createFinanceCategoryRepository,
  createMonthlyBudgetRepository,
  createTransactionRepository,
} from "./repository";
import {
  calculateTotals,
  createFinanceService,
  sumByCategory,
} from "./service";

const groceriesId = "00000000-0000-4000-8000-000000002101";
const salaryId = "00000000-0000-4000-8000-000000002102";
let database: PersonalOsDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(async () => {
  await deleteTestDatabase(database);
});

function buildService() {
  return createFinanceService(
    createFinanceCategoryRepository(database, {
      idGenerator: () => groceriesId,
    }),
    createTransactionRepository(database),
    createMonthlyBudgetRepository(database),
  );
}

function buildTransaction(
  overrides: Partial<Transaction> & Pick<Transaction, "kind" | "money">,
): Transaction {
  return {
    bookedOn: "2026-08-04",
    categoryId: groceriesId,
    createdAt: "2026-08-04T08:00:00.000Z",
    id: salaryId,
    updatedAt: "2026-08-04T08:00:00.000Z",
    ...overrides,
  } as Transaction;
}

describe("removeCategory", () => {
  it("archives a used category instead of breaking references", async () => {
    const service = buildService();
    const category = await service.createCategory({
      kind: "expense",
      name: "Beispiel Einkauf",
    });
    const transaction = await service.createTransaction({
      bookedOn: "2026-08-04",
      categoryId: category.id,
      kind: "expense",
      money: { amountMinor: 1_250, currency: "EUR" },
    });

    const removal = await service.removeCategory(category.id);

    expect(removal).toMatchObject({ kind: "archived", usageCount: 1 });
    const stored = await service.listTransactions();
    expect(stored[0]?.categoryId).toBe(category.id);
    expect(stored[0]?.id).toBe(transaction.id);

    const archived = await service.listCategories({ includeArchived: true });
    expect(archived[0]?.archivedAt).toBeDefined();
  });

  it("deletes an unused category permanently", async () => {
    const service = buildService();
    const category = await service.createCategory({
      kind: "income",
      name: "Beispiel Nebeneinkunft",
    });

    const removal = await service.removeCategory(category.id);

    expect(removal).toEqual({ categoryId: category.id, kind: "deleted" });
    expect(
      await service.listCategories({ includeArchived: true }),
    ).toHaveLength(0);
  });
});

describe("setBudget", () => {
  it("keeps at most one active budget per month and category", async () => {
    const service = buildService();

    const first = await service.setBudget({
      categoryId: groceriesId,
      limit: { amountMinor: 20_000, currency: "EUR" },
      month: "2026-08",
    });
    const second = await service.setBudget({
      categoryId: groceriesId,
      limit: { amountMinor: 25_000, currency: "EUR" },
      month: "2026-08",
    });

    expect(second.id).toBe(first.id);
    expect(second.limit.amountMinor).toBe(25_000);
    expect(await service.listBudgets("2026-08")).toHaveLength(1);
  });

  it("separates months and categories", async () => {
    const service = buildService();
    await service.setBudget({
      categoryId: groceriesId,
      limit: { amountMinor: 20_000, currency: "EUR" },
      month: "2026-08",
    });
    await service.setBudget({
      categoryId: groceriesId,
      limit: { amountMinor: 18_000, currency: "EUR" },
      month: "2026-09",
    });
    await service.setBudget({
      categoryId: salaryId,
      limit: { amountMinor: 5_000, currency: "EUR" },
      month: "2026-08",
    });

    expect(await service.listBudgets("2026-08")).toHaveLength(2);
    expect(await service.listBudgets("2026-09")).toHaveLength(1);
  });

  // Der eindeutige Index gilt datenbankweit. Ein archiviertes Budget würde die
  // Kombination dauerhaft blockieren, deshalb wird endgültig entfernt.
  it("frees the combination again after removal", async () => {
    const service = buildService();
    const budget = await service.setBudget({
      categoryId: groceriesId,
      limit: { amountMinor: 20_000, currency: "EUR" },
      month: "2026-08",
    });

    await service.removeBudget(budget.id);
    expect(await service.listBudgets("2026-08")).toHaveLength(0);

    const replacement = await service.setBudget({
      categoryId: groceriesId,
      limit: { amountMinor: 9_000, currency: "EUR" },
      month: "2026-08",
    });

    expect(replacement.id).not.toBe(budget.id);
    expect(await service.listBudgets("2026-08")).toHaveLength(1);
    expect(replacement.limit.amountMinor).toBe(9_000);
  });
});

describe("calculateTotals", () => {
  it("keeps income and expense apart and reports an integer balance", () => {
    const totals = calculateTotals(
      [
        buildTransaction({
          kind: "income",
          money: { amountMinor: 200_000, currency: "EUR" },
        }),
        buildTransaction({
          kind: "expense",
          money: { amountMinor: 1_250, currency: "EUR" },
        }),
        buildTransaction({
          kind: "expense",
          money: { amountMinor: 75, currency: "EUR" },
        }),
      ],
      "EUR",
    );

    expect(totals.income.amountMinor).toBe(200_000);
    expect(totals.expense.amountMinor).toBe(1_325);
    expect(totals.balanceMinor).toBe(198_675);
  });

  it("stays neutral without any transaction", () => {
    const totals = calculateTotals([], "EUR");

    expect(totals.income.amountMinor).toBe(0);
    expect(totals.expense.amountMinor).toBe(0);
    expect(totals.balanceMinor).toBe(0);
  });

  it("reports a negative balance when expenses exceed income", () => {
    const totals = calculateTotals(
      [
        buildTransaction({
          kind: "income",
          money: { amountMinor: 1_000, currency: "EUR" },
        }),
        buildTransaction({
          kind: "expense",
          money: { amountMinor: 2_500, currency: "EUR" },
        }),
      ],
      "EUR",
    );

    expect(totals.balanceMinor).toBe(-1_500);
  });
});

describe("sumByCategory", () => {
  it("adds every amount of the same category", () => {
    const totals = sumByCategory(
      [
        buildTransaction({
          categoryId: groceriesId,
          kind: "expense",
          money: { amountMinor: 1_250, currency: "EUR" },
        }),
        buildTransaction({
          categoryId: groceriesId,
          kind: "expense",
          money: { amountMinor: 750, currency: "EUR" },
        }),
        buildTransaction({
          categoryId: salaryId,
          kind: "income",
          money: { amountMinor: 500, currency: "EUR" },
        }),
      ],
      "EUR",
    );

    expect(totals.get(groceriesId)?.amountMinor).toBe(2_000);
    expect(totals.get(salaryId)?.amountMinor).toBe(500);
  });
});
