import { describe, expect, it } from "vitest";

import {
  expectedAugust,
  financeMonthBudgets,
  financeMonthCategories,
  financeMonthContributions,
  financeMonthSavingsGoals,
  financeMonthTransactions,
} from "../../test/fixtures/finance-month";
import { MixedCurrencyError } from "./mixed-currency";
import type { Transaction } from "./model";
import { buildMonthlyOverview, type MonthlyOverviewInput } from "./overview";

function build(overrides: Partial<MonthlyOverviewInput> = {}) {
  return buildMonthlyOverview({
    budgets: financeMonthBudgets,
    contributions: financeMonthContributions,
    currency: "EUR",
    month: "2026-08",
    savingsGoals: financeMonthSavingsGoals,
    transactions: financeMonthTransactions,
    ...overrides,
  });
}

describe("buildMonthlyOverview", () => {
  it("matches the independently calculated golden fixture", () => {
    const overview = build();

    expect(overview.income.amountMinor).toBe(expectedAugust.incomeMinor);
    expect(overview.expense.amountMinor).toBe(expectedAugust.expenseMinor);
    expect(overview.balanceMinor).toBe(expectedAugust.balanceMinor);
    expect(overview.transactionCount).toBe(expectedAugust.transactionCount);
  });

  it("names the period and the currency of every figure", () => {
    const overview = build();

    expect(overview.month).toBe("2026-08");
    expect(overview.currency).toBe("EUR");
    expect(overview.income.currency).toBe("EUR");
    expect(overview.expense.currency).toBe("EUR");
  });

  it("ranks the expense categories and reports their share", () => {
    const overview = build();

    expect(
      overview.expenseByCategory.map(
        ({ amountMinor, categoryId, transactionCount }) => ({
          amountMinor,
          categoryId,
          transactionCount,
        }),
      ),
    ).toEqual(expectedAugust.expenseByCategory);
    // 680,00 von 1.103,00 sind rund 61,6 Prozent.
    expect(overview.expenseByCategory[0]!.ratio).toBeCloseTo(0.6165, 4);
  });

  it("sums only the budgets of the same month", () => {
    expect(build().budget).toEqual(expectedAugust.budget);
  });

  it("leaves the budget out when the month has none", () => {
    expect(build({ month: "2026-07" }).budget).toBeUndefined();
  });

  it("compares with the previous month", () => {
    const comparison = build().previousExpense;

    expect(comparison).toEqual({
      differenceMinor: expectedAugust.previousDifferenceMinor,
      kind: "available",
      previousMinor: expectedAugust.previousExpenseMinor,
      ratio: expect.closeTo(0.1141, 4),
    });
  });

  // Eine fehlende Grundlage wird benannt statt als 0 Prozent erfunden.
  it("explains a missing comparison instead of inventing zero percent", () => {
    const comparison = build({ month: "2026-07" }).previousExpense;

    expect(comparison).toEqual({
      kind: "unavailable",
      reason: "Für den Vormonat ist keine Buchung erfasst.",
    });
  });

  it("reports no relative change when the previous month had no expense", () => {
    const income = financeMonthTransactions.filter(
      (entry) => entry.kind === "income",
    );
    const july: Transaction = {
      ...income[0]!,
      bookedOn: "2026-07-20",
      id: "00000000-0000-4000-8000-000000009999",
    };
    const comparison = build({
      transactions: [...financeMonthTransactions, july],
      month: "2026-08",
    }).previousExpense;

    expect(comparison.kind).toBe("available");
  });

  // Der Sparstand ist kumulativ; er wird nicht auf den Monat beschnitten.
  it("counts only active savings goals in the short status", () => {
    expect(build().savings).toEqual({
      activeGoalCount: expectedAugust.savings.activeGoalCount,
      ratio: 0.35,
      savedMinor: expectedAugust.savings.savedMinor,
      targetMinor: expectedAugust.savings.targetMinor,
    });
  });

  it("stays neutral and empty without any booking", () => {
    const overview = build({ budgets: [], transactions: [] });

    expect(overview.income.amountMinor).toBe(0);
    expect(overview.expense.amountMinor).toBe(0);
    expect(overview.balanceMinor).toBe(0);
    expect(overview.expenseByCategory).toEqual([]);
    expect(overview.budget).toBeUndefined();
    expect(overview.previousExpense.kind).toBe("unavailable");
  });

  it("ignores archived bookings", () => {
    const archived: Transaction = {
      ...financeMonthTransactions[1]!,
      archivedAt: "2026-08-20T08:00:00.000Z",
      id: "00000000-0000-4000-8000-000000009998",
    };
    const overview = build({
      transactions: [...financeMonthTransactions, archived],
    });

    expect(overview.expense.amountMinor).toBe(expectedAugust.expenseMinor);
  });

  it("refuses to mix currencies instead of converting them", () => {
    const foreign: Transaction = {
      ...financeMonthTransactions[1]!,
      id: "00000000-0000-4000-8000-000000009997",
      money: { amountMinor: 1_000, currency: "CHF" },
    };

    expect(() =>
      build({ transactions: [...financeMonthTransactions, foreign] }),
    ).toThrow(MixedCurrencyError);
  });

  it("names a budget in a foreign currency instead of adding it", () => {
    expect(() =>
      build({
        budgets: [
          {
            ...financeMonthBudgets[0]!,
            limit: { amountMinor: 1_000, currency: "CHF" },
          },
        ],
      }),
    ).toThrow(MixedCurrencyError);
  });

  it("leaves the share without a value when nothing was spent", () => {
    const incomeOnly = financeMonthTransactions.filter(
      (entry) => entry.kind === "income",
    );
    const overview = build({ budgets: [], transactions: incomeOnly });

    expect(overview.expenseByCategory).toEqual([]);
    expect(overview.expense.amountMinor).toBe(0);
  });

  // Die Verdichtung ist schreibgeschützt; sie fasst keine Buchung an.
  it("does not touch the given records", () => {
    const snapshot = structuredClone(financeMonthTransactions);
    build();

    expect(financeMonthTransactions).toEqual(snapshot);
    expect(financeMonthCategories.rent).toBeDefined();
  });
});
