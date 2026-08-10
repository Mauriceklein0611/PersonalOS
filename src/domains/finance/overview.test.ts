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
import type {
  FinanceCategory,
  SavingsContribution,
  SavingsGoal,
  Transaction,
} from "./model";
import type { DueRecurringTransaction } from "./recurring";
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
      excludedGoalCount: expectedAugust.savings.excludedGoalCount,
      ratio: 0.35,
      savedMinor: expectedAugust.savings.savedMinor,
      targetMinor: expectedAugust.savings.targetMinor,
    });
  });

  /*
   * Regression: Die Summe addierte zuvor Minor Units verschiedener Währungen.
   * 50.000 JPY neben 35.000 von 100.000 EUR ergaben eine Zahl, die als Euro
   * dargestellt wurde.
   */
  it("keeps a savings goal in another currency out of every sum", () => {
    const overview = build(withYenGoal());

    expect(overview.savings).toEqual({
      activeGoalCount: 1,
      excludedGoalCount: 1,
      ratio: 0.35,
      savedMinor: 35_000,
      targetMinor: 100_000,
    });
  });

  it("reports no counted goal when every active goal uses another currency", () => {
    const { contributions, savingsGoals } = withYenGoal();

    const overview = build({
      contributions,
      savingsGoals: savingsGoals.filter(
        (goal) => goal.target.currency !== "EUR",
      ),
    });

    expect(overview.savings).toEqual({
      activeGoalCount: 0,
      excludedGoalCount: 1,
      ratio: null,
      savedMinor: 0,
      targetMinor: 0,
    });
  });

  /*
   * Der Kern von C-03: Wer 245,50 € spart und die Ausgabe verknüpft, hat den
   * Betrag genau einmal im System. Der Saldo ändert sich durch den Beitrag
   * nicht mehr, weil die Ausgabe ihn bereits enthält.
   */
  it("counts a linked contribution exactly once", () => {
    const linkedExpense = financeMonthTransactions[2]!;
    const overview = build({
      contributions: [
        {
          ...financeMonthContributions[0]!,
          money: linkedExpense.money,
          sourceTransactionId: linkedExpense.id,
        },
      ],
    });

    expect(overview.savingsThisMonth).toEqual({
      contributionCount: 1,
      linkedMinor: 24_550,
      totalMinor: 24_550,
      unlinkedMinor: 0,
    });
    expect(overview.balanceAfterSavingsMinor).toBe(overview.balanceMinor);
  });

  it("subtracts a contribution that no expense covers", () => {
    const overview = build({
      contributions: [financeMonthContributions[0]!],
    });

    expect(overview.savingsThisMonth).toEqual({
      contributionCount: 1,
      linkedMinor: 0,
      totalMinor: 25_000,
      unlinkedMinor: 25_000,
    });
    expect(overview.balanceAfterSavingsMinor).toBe(
      overview.balanceMinor - 25_000,
    );
  });

  /*
   * Eine archivierte Ausgabe steckt nicht mehr in der Monatssumme. Der Beitrag
   * gilt dann wieder als unbelegt, sonst verschwände der Betrag aus beiden
   * Zahlen.
   */
  it("stops treating a contribution as covered when its expense is archived", () => {
    const linkedExpense = financeMonthTransactions[2]!;
    const overview = build({
      contributions: [
        {
          ...financeMonthContributions[0]!,
          money: linkedExpense.money,
          sourceTransactionId: linkedExpense.id,
        },
      ],
      transactions: financeMonthTransactions.map((transaction) =>
        transaction.id === linkedExpense.id
          ? { ...transaction, archivedAt: "2026-08-20T08:00:00.000Z" }
          : transaction,
      ),
    });

    expect(overview.savingsThisMonth.linkedMinor).toBe(0);
    expect(overview.savingsThisMonth.unlinkedMinor).toBe(24_550);
  });

  it("counts only contributions with a date inside the month", () => {
    const overview = build();

    /*
     * 9401 und 9403 liegen im August, 9402 im Juli. Der Beitrag zum
     * abgeschlossenen Sparziel zählt mit: Das Geld ist geflossen, unabhängig
     * vom Status des Ziels.
     */
    expect(overview.savingsThisMonth.contributionCount).toBe(2);
    expect(overview.savingsThisMonth.totalMinor).toBe(75_000);
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

/**
 * Das abgeschlossene Ziel der Vorlage wird zum aktiven Ziel in JPY, sein
 * Beitrag ebenfalls. Umgerechnet wird nichts.
 */
function withYenGoal(): Pick<
  MonthlyOverviewInput,
  "contributions" | "savingsGoals"
> {
  const yenGoal: SavingsGoal = {
    ...financeMonthSavingsGoals[1]!,
    status: "active",
    target: { amountMinor: 100_000, currency: "JPY" },
  };
  const yenContribution: SavingsContribution = {
    ...financeMonthContributions[2]!,
    money: { amountMinor: 50_000, currency: "JPY" },
  };

  return {
    contributions: [
      financeMonthContributions[0]!,
      financeMonthContributions[1]!,
      yenContribution,
    ],
    savingsGoals: [financeMonthSavingsGoals[0]!, yenGoal],
  };
}

/**
 * „Frei verfügbar" beantwortet, was diesen Monat **noch** ausgegeben werden
 * kann. Der Fixtures-Monat: Einnahmen 2.400,00, Ausgaben 1.103,00 (davon
 * 680,00 Miete), unverknüpfte Sparbeiträge 750,00.
 */
describe("frei verfügbar", () => {
  const rentIsFixed: FinanceCategory[] = [
    {
      ...categoryMeta("000000009901"),
      id: financeMonthCategories.rent,
      isFixedCost: true,
      kind: "expense",
      name: "Wohnen",
    },
    {
      ...categoryMeta("000000009902"),
      id: financeMonthCategories.groceries,
      kind: "expense",
      name: "Lebensmittel",
    },
  ];

  // Ohne gepflegte Fixkosten erscheint die Zahl nicht, statt eine falsche.
  it("stays absent while no category is kept as a fixed cost", () => {
    expect(build().freelyAvailable).toBeUndefined();
    expect(
      build({
        categories: rentIsFixed.map((category) => ({
          ...category,
          isFixedCost: undefined,
        })),
      }).freelyAvailable,
    ).toBeUndefined();
  });

  it("splits the month into fixed, variable and planned saving", () => {
    const freely = build({ categories: rentIsFixed }).freelyAvailable;

    expect(freely).toEqual({
      amountMinor: 54_700,
      bookedFixedMinor: 68_000,
      openFixedCount: 0,
      openFixedMinor: 0,
      plannedSavingsMinor: 75_000,
      variableMinor: 42_300,
    });
  });

  /**
   * Der Kern: Eine Miete, die am 28. abgeht, ist am 5. schon gebunden. Ohne
   * die offenen Vorlagen wäre die Zahl rechnerisch dasselbe wie
   * `balanceAfterSavingsMinor` und das Fixkosten-Flag ohne Wirkung.
   */
  it("subtracts fixed costs that are still open this month", () => {
    const withoutTemplates = build({ categories: rentIsFixed });
    const withTemplate = build({
      categories: rentIsFixed,
      dueTemplates: [dueTemplate(30_000, financeMonthCategories.rent)],
    });

    expect(withoutTemplates.freelyAvailable?.amountMinor).toBe(
      withoutTemplates.balanceAfterSavingsMinor,
    );
    expect(withTemplate.freelyAvailable?.amountMinor).toBe(24_700);
    expect(withTemplate.freelyAvailable?.openFixedMinor).toBe(30_000);
    expect(withTemplate.freelyAvailable?.openFixedCount).toBe(1);
  });

  // Eine bestätigte Vorlage ist gebucht und steht nicht mehr als fällig an;
  // eine Vorlage einer variablen Kategorie bindet nichts.
  it("ignores a due template of a category that is not a fixed cost", () => {
    const freely = build({
      categories: rentIsFixed,
      dueTemplates: [dueTemplate(30_000, financeMonthCategories.groceries)],
    }).freelyAvailable;

    expect(freely?.openFixedMinor).toBe(0);
    expect(freely?.amountMinor).toBe(54_700);
  });

  /**
   * Ein Sparbeitrag, der eine Ausgabe belegt, steckt bereits in den Ausgaben.
   * Er darf nicht ein zweites Mal abgezogen werden.
   */
  it("counts a contribution that backs a booking only once", () => {
    const backed = financeMonthContributions.map((contribution, index) =>
      index === 0
        ? {
            ...contribution,
            money: { amountMinor: 24_550, currency: "EUR" },
            sourceTransactionId: financeMonthTransactions[2]!.id,
          }
        : contribution,
    );

    const freely = build({
      categories: rentIsFixed,
      contributions: backed,
    }).freelyAvailable;

    // Nur die 500,00 des unverknüpften Beitrags gehen ab, nicht zusätzlich
    // die 245,50, die schon als Ausgabe zählen.
    expect(freely?.plannedSavingsMinor).toBe(50_000);
    expect(freely?.amountMinor).toBe(240_000 - 68_000 - 50_000 - 42_300);
  });
});

function categoryMeta(suffix: string) {
  return {
    createdAt: "2026-08-01T08:00:00.000Z",
    id: `00000000-0000-4000-8000-${suffix}`,
    updatedAt: "2026-08-01T08:00:00.000Z",
  };
}

function dueTemplate(
  amountMinor: number,
  categoryId: string,
): DueRecurringTransaction {
  return {
    proposedDate: "2026-08-28",
    template: {
      ...categoryMeta("000000009903"),
      categoryId,
      dayOfMonth: 28,
      kind: "expense",
      money: { amountMinor, currency: "EUR" },
      name: "Synthetische Vorlage",
    },
  };
}
