import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createBackupService } from "../../db/backup/service";
import type { PersonalOsDatabase } from "../../db/database";
import { personalOsTableNames } from "../../db/schema";
import { createTestDatabase, deleteTestDatabase } from "../../test/database";
import {
  createFinanceCategoryRepository,
  createMonthlyBudgetRepository,
  createSavingsContributionRepository,
  createSavingsGoalRepository,
  createTransactionRepository,
} from "./repository";
import { buildMonthlyOverview, type MonthlyOverview } from "./overview";

const month = "2026-08";
let database: PersonalOsDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(async () => {
  await deleteTestDatabase(database);
});

async function seed() {
  const categories = createFinanceCategoryRepository(database);
  const transactions = createTransactionRepository(database);
  const budgets = createMonthlyBudgetRepository(database);
  const goals = createSavingsGoalRepository(database);
  const contributions = createSavingsContributionRepository(database);

  const groceries = await categories.create({
    kind: "expense",
    name: "Beispiel Einkauf",
  });
  const salary = await categories.create({
    kind: "income",
    name: "Beispiel Einkommen",
  });

  await transactions.create({
    bookedOn: "2026-08-01",
    categoryId: salary.id,
    kind: "income",
    money: { amountMinor: 240_000, currency: "EUR" },
  });
  await transactions.create({
    bookedOn: "2026-08-04",
    categoryId: groceries.id,
    kind: "expense",
    money: { amountMinor: 24_550, currency: "EUR" },
  });
  await transactions.create({
    bookedOn: "2026-07-15",
    categoryId: groceries.id,
    kind: "expense",
    money: { amountMinor: 31_000, currency: "EUR" },
  });
  await budgets.create({
    categoryId: groceries.id,
    limit: { amountMinor: 30_000, currency: "EUR" },
    month,
  });
  const goal = await goals.create({
    name: "Synthetische Rücklage",
    status: "active",
    target: { amountMinor: 100_000, currency: "EUR" },
  });
  await contributions.create({
    bookedOn: "2026-08-05",
    money: { amountMinor: 25_000, currency: "EUR" },
    savingsGoalId: goal.id,
  });
}

async function readOverview(): Promise<MonthlyOverview> {
  return buildMonthlyOverview({
    budgets: await createMonthlyBudgetRepository(database).listForMonth(month),
    contributions: await createSavingsContributionRepository(database).list(),
    currency: "EUR",
    month,
    savingsGoals: await createSavingsGoalRepository(database).list(),
    transactions: await createTransactionRepository(database).listFiltered(),
  });
}

describe("monthly overview across export and import", () => {
  it("restores an identical overview after a full reset", async () => {
    await seed();
    const before = await readOverview();
    expect(before.expense.amountMinor).toBe(24_550);

    const backupService = createBackupService(database);
    const backup = await backupService.create();

    await database.transaction(
      "rw",
      personalOsTableNames.map((name) => database.table(name)),
      async () => {
        for (const name of personalOsTableNames) {
          await database.table(name).clear();
        }
      },
    );
    const emptied = await readOverview();
    expect(emptied.transactionCount).toBe(0);
    expect(emptied.budget).toBeUndefined();

    await backupService.replace(
      backupService.parse(JSON.stringify(backup)),
      () => undefined,
    );

    expect(await readOverview()).toEqual(before);
  });
});

describe("monthly overview with a large local dataset", () => {
  /*
   * Die Verdichtung läuft bei jeder Änderung neu. Sie muss deshalb auch bei
   * realistisch vielen Buchungen in einem Zug durchlaufen, ohne dass die
   * Laufzeit mit der Zahl der Kategorien überproportional wächst.
   */
  it("stays responsive with several thousand bookings", () => {
    const categoryCount = 40;
    const transactions = Array.from({ length: 6_000 }, (_, index) => ({
      archivedAt: undefined,
      bookedOn: `2026-0${(index % 2) + 7}-${String((index % 28) + 1).padStart(2, "0")}`,
      categoryId: `category-${index % categoryCount}`,
      createdAt: "2026-08-01T08:00:00.000Z",
      id: `transaction-${index}`,
      kind: index % 5 === 0 ? ("income" as const) : ("expense" as const),
      money: { amountMinor: 100 + (index % 900), currency: "EUR" },
      updatedAt: "2026-08-01T08:00:00.000Z",
    }));

    const startedAt = performance.now();
    const overview = buildMonthlyOverview({
      budgets: [],
      contributions: [],
      currency: "EUR",
      month,
      savingsGoals: [],
      transactions,
    });
    const duration = performance.now() - startedAt;

    // Die Erwartung stammt aus den Daten selbst; eine feste Zahl würde nur
    // die Wechselwirkung der Streuung nachbauen.
    const expectedCategories = new Set(
      transactions
        .filter(
          (entry) =>
            entry.kind === "expense" && entry.bookedOn.startsWith(month),
        )
        .map((entry) => entry.categoryId),
    );

    expect(overview.transactionCount).toBeGreaterThan(2_000);
    expect(overview.expenseByCategory).toHaveLength(expectedCategories.size);
    expect(expectedCategories.size).toBeGreaterThan(10);
    expect(
      overview.expenseByCategory.map((share) => share.amountMinor),
    ).toEqual(
      [...overview.expenseByCategory]
        .map((share) => share.amountMinor)
        .sort((left, right) => right - left),
    );
    expect(duration).toBeLessThan(250);
  });
});
