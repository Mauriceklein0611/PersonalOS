import { describe, expect, it } from "vitest";

import { buildEntityMeta } from "../../test/factories/entity";
import type {
  FinanceCategory,
  MonthlyBudget,
  SavingsContribution,
  SavingsGoal,
  Transaction,
} from "../finance/model";
import type { TodayContext, TodayOverview } from "./queries";
import {
  buildTodaySignals,
  describeRemainingBudget,
  maximumSignals,
} from "./signals";

const context: TodayContext = {
  hour: 9,
  timeZone: "Europe/Berlin",
  today: "2026-08-12",
};

function buildOverview(overrides: Partial<TodayOverview> = {}): TodayOverview {
  return {
    completedTaskCount: 0,
    dueHabits: [],
    greeting: "morning",
    habitDueCount: 0,
    habitSettledCount: 0,
    journal: {
      filledFieldCount: 0,
      hasEntryToday: false,
      showEveningHint: false,
    },
    openTasks: [],
    overdueTaskCount: 0,
    progress: { done: 0, planned: 0, ratio: null },
    settledHabits: [],
    ...overrides,
  };
}

function buildCategory(id: string, name: string): FinanceCategory {
  return {
    ...buildEntityMeta({ id }),
    kind: "expense",
    name,
  };
}

function buildBudget(
  id: string,
  categoryId: string,
  limitMinor: number,
): MonthlyBudget {
  return {
    ...buildEntityMeta({ id }),
    categoryId,
    limit: { amountMinor: limitMinor, currency: "EUR" },
    month: "2026-08",
  };
}

function buildExpense(
  id: string,
  categoryId: string,
  amountMinor: number,
): Transaction {
  return {
    ...buildEntityMeta({ id }),
    bookedOn: "2026-08-05",
    categoryId,
    kind: "expense",
    money: { amountMinor, currency: "EUR" },
  };
}

function buildGoal(
  id: string,
  name: string,
  targetDate: string | undefined,
): SavingsGoal {
  return {
    ...buildEntityMeta({ id }),
    name,
    status: "active",
    target: { amountMinor: 100_000, currency: "EUR" },
    ...(targetDate === undefined ? {} : { targetDate }),
  } as SavingsGoal;
}

function buildContribution(
  id: string,
  savingsGoalId: string,
  amountMinor: number,
): SavingsContribution {
  return {
    ...buildEntityMeta({ id }),
    bookedOn: "2026-08-01",
    money: { amountMinor, currency: "EUR" },
    savingsGoalId,
  };
}

const emptyFinance = {
  budgets: [],
  categories: [],
  contributions: [],
  savingsGoals: [],
  transactions: [],
};

describe("buildTodaySignals", () => {
  it("stays silent when nothing is remarkable", () => {
    const signals = buildTodaySignals(
      { ...emptyFinance, overview: buildOverview() },
      context,
    );

    // Der leere Bereich ist die Aussage: alles im Rahmen.
    expect(signals).toEqual([]);
  });

  it("names overdue tasks with their count", () => {
    const signals = buildTodaySignals(
      { ...emptyFinance, overview: buildOverview({ overdueTaskCount: 3 }) },
      context,
    );

    expect(signals).toHaveLength(1);
    expect(signals[0]?.text).toBe("3 Aufgaben aus den Vortagen");
    expect(signals[0]?.kind).toBe("overdue");
  });

  it("reports a budget past the notice threshold with the day of the month", () => {
    const signals = buildTodaySignals(
      {
        ...emptyFinance,
        budgets: [buildBudget("budget-1", "category-1", 10_000)],
        categories: [buildCategory("category-1", "Restaurant")],
        overview: buildOverview(),
        transactions: [buildExpense("transaction-1", "category-1", 8_200)],
      },
      context,
    );

    expect(signals[0]?.text).toBe(
      "Restaurant: 82 % des Monatsbudgets nach 12 Tagen",
    );
  });

  it("stays silent below the notice threshold", () => {
    const signals = buildTodaySignals(
      {
        ...emptyFinance,
        budgets: [buildBudget("budget-1", "category-1", 10_000)],
        categories: [buildCategory("category-1", "Restaurant")],
        overview: buildOverview(),
        transactions: [buildExpense("transaction-1", "category-1", 7_900)],
      },
      context,
    );

    expect(signals).toEqual([]);
  });

  it("puts an exceeded budget before a category merely near its limit", () => {
    const signals = buildTodaySignals(
      {
        ...emptyFinance,
        budgets: [
          buildBudget("budget-1", "category-1", 10_000),
          buildBudget("budget-2", "category-2", 10_000),
        ],
        categories: [
          buildCategory("category-1", "Restaurant"),
          buildCategory("category-2", "Mobilität"),
        ],
        overview: buildOverview(),
        transactions: [
          buildExpense("transaction-1", "category-1", 8_200),
          buildExpense("transaction-2", "category-2", 12_000),
        ],
      },
      context,
    );

    // Die überschrittene Kategorie führt, die zweite wird gezählt statt
    // verschwiegen.
    expect(signals[0]?.text).toBe(
      "Mobilität: Monatsbudget überschritten nach 12 Tagen · 1 weitere Kategorie über 80 %",
    );
  });

  it("reports a savings deadline only when the goal lags behind", () => {
    const input = {
      ...emptyFinance,
      contributions: [buildContribution("contribution-1", "goal-1", 60_000)],
      overview: buildOverview(),
      savingsGoals: [buildGoal("goal-1", "Notgroschen", "2026-08-15")],
    };

    expect(buildTodaySignals(input, context)[0]?.text).toBe(
      "Notgroschen: Frist in 3 Tagen, 60 % erreicht",
    );

    // Auf Kurs: keine Zeile.
    expect(
      buildTodaySignals(
        {
          ...input,
          contributions: [
            buildContribution("contribution-1", "goal-1", 90_000),
          ],
        },
        context,
      ),
    ).toEqual([]);
  });

  it("ignores a deadline that is still far away", () => {
    const signals = buildTodaySignals(
      {
        ...emptyFinance,
        contributions: [buildContribution("contribution-1", "goal-1", 10_000)],
        overview: buildOverview(),
        savingsGoals: [buildGoal("goal-1", "Notgroschen", "2026-12-01")],
      },
      context,
    );

    expect(signals).toEqual([]);
  });

  it("mentions the planned time only when it exceeds the daily budget", () => {
    const overBudget = buildOverview({
      capacity: {
        budgetMinutes: 300,
        estimatedTaskCount: 4,
        isOverBudget: true,
        totalMinutes: 400,
        unestimatedTaskCount: 0,
      },
    });
    expect(
      buildTodaySignals({ ...emptyFinance, overview: overBudget }, context)[0]
        ?.text,
    ).toBe("Heute geplant: 6 h 40 min");

    const withinBudget = buildOverview({
      capacity: {
        budgetMinutes: 300,
        estimatedTaskCount: 4,
        isOverBudget: false,
        totalMinutes: 200,
        unestimatedTaskCount: 0,
      },
    });
    expect(
      buildTodaySignals({ ...emptyFinance, overview: withinBudget }, context),
    ).toEqual([]);
  });

  it("offers the reflection in the evening, without an entry", () => {
    const signals = buildTodaySignals(
      {
        ...emptyFinance,
        overview: buildOverview({
          journal: {
            filledFieldCount: 0,
            hasEntryToday: false,
            showEveningHint: true,
          },
        }),
      },
      { ...context, hour: 20 },
    );

    expect(signals[0]?.text).toBe(
      "Der Abend ist ein guter Moment für die Reflexion",
    );
    expect(signals[0]?.tone).toBe("info");
  });

  /*
   * Die Obergrenze ist der Punkt der ganzen Ebene: Ein Dashboard, das mit der
   * Datenmenge wächst, ist ein Bericht. Was zurückliegt, steht vor dem, was
   * ansteht; was ansteht, vor dem, was nur ein Hinweis ist.
   */
  it("keeps at most three rows and drops the least urgent", () => {
    const signals = buildTodaySignals(
      {
        budgets: [buildBudget("budget-1", "category-1", 10_000)],
        categories: [buildCategory("category-1", "Restaurant")],
        contributions: [buildContribution("contribution-1", "goal-1", 10_000)],
        overview: buildOverview({
          capacity: {
            budgetMinutes: 300,
            estimatedTaskCount: 4,
            isOverBudget: true,
            totalMinutes: 400,
            unestimatedTaskCount: 0,
          },
          journal: {
            filledFieldCount: 0,
            hasEntryToday: false,
            showEveningHint: true,
          },
          overdueTaskCount: 2,
        }),
        savingsGoals: [buildGoal("goal-1", "Notgroschen", "2026-08-15")],
        transactions: [buildExpense("transaction-1", "category-1", 12_000)],
      },
      { ...context, hour: 20 },
    );

    expect(signals).toHaveLength(maximumSignals);
    expect(signals.map((signal) => signal.kind)).toEqual([
      "overdue",
      "budget",
      "savings",
    ]);
  });
});

describe("describeRemainingBudget", () => {
  it("stays absent without a single budget for the month", () => {
    expect(
      describeRemainingBudget({ budgets: [], transactions: [] }, context),
    ).toBeUndefined();
  });

  it("sums the remaining amount across the budgets of the month", () => {
    const result = describeRemainingBudget(
      {
        budgets: [
          buildBudget("budget-1", "category-1", 10_000),
          buildBudget("budget-2", "category-2", 20_000),
        ],
        transactions: [buildExpense("transaction-1", "category-1", 4_000)],
      },
      context,
    );

    expect(result?.value).toContain("260,00");
    expect(result?.context).toContain("2 gesetzte Budgets");
  });

  it("names an overrun as a negative amount instead of capping it at zero", () => {
    const result = describeRemainingBudget(
      {
        budgets: [buildBudget("budget-1", "category-1", 10_000)],
        transactions: [buildExpense("transaction-1", "category-1", 13_000)],
      },
      context,
    );

    expect(result?.value).toContain("30,00");
    expect(result?.value.startsWith("−")).toBe(true);
  });
});
