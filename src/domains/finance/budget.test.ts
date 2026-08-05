import { describe, expect, it } from "vitest";

import {
  calculateBudgetUsage,
  findBudget,
  monthOfDay,
  shiftMonth,
} from "./budget";
import { MixedCurrencyError } from "./mixed-currency";
import type { MonthlyBudget, Transaction } from "./model";

const groceriesId = "00000000-0000-4000-8000-000000005101";
const otherId = "00000000-0000-4000-8000-000000005102";

function buildBudget(overrides: Partial<MonthlyBudget> = {}): MonthlyBudget {
  return {
    categoryId: groceriesId,
    createdAt: "2026-08-01T08:00:00.000Z",
    id: "00000000-0000-4000-8000-000000005201",
    limit: { amountMinor: 20_000, currency: "EUR" },
    month: "2026-08",
    updatedAt: "2026-08-01T08:00:00.000Z",
    ...overrides,
  } as MonthlyBudget;
}

function buildTransaction(
  amountMinor: number,
  overrides: Partial<Transaction> = {},
): Transaction {
  return {
    bookedOn: "2026-08-04",
    categoryId: groceriesId,
    createdAt: "2026-08-04T08:00:00.000Z",
    id: `00000000-0000-4000-8000-0000000053${String(amountMinor).slice(0, 2)}`,
    kind: "expense",
    money: { amountMinor, currency: "EUR" },
    updatedAt: "2026-08-04T08:00:00.000Z",
    ...overrides,
  } as Transaction;
}

describe("calculateBudgetUsage", () => {
  it("counts only expenses of the same category in the chosen month", () => {
    const usage = calculateBudgetUsage(buildBudget(), [
      buildTransaction(5_000),
      buildTransaction(2_500),
      // Einnahme, andere Kategorie, anderer Monat und archiviert zählen nicht.
      buildTransaction(9_900, { kind: "income" }),
      buildTransaction(9_900, { categoryId: otherId }),
      buildTransaction(9_900, { bookedOn: "2026-07-31" }),
      buildTransaction(9_900, { archivedAt: "2026-08-05T08:00:00.000Z" }),
    ]);

    expect(usage.spentMinor).toBe(7_500);
    expect(usage.remainingMinor).toBe(12_500);
    expect(usage.transactionCount).toBe(2);
    expect(usage.state).toBe("within");
  });

  it("uses integer arithmetic for the remainder", () => {
    const usage = calculateBudgetUsage(
      buildBudget({ limit: { amountMinor: 10, currency: "EUR" } }),
      [buildTransaction(1), buildTransaction(2)],
    );

    expect(Number.isInteger(usage.spentMinor)).toBe(true);
    expect(Number.isInteger(usage.remainingMinor)).toBe(true);
    expect(usage.remainingMinor).toBe(7);
  });

  it("reports an exceeded budget plainly and without blame", () => {
    const usage = calculateBudgetUsage(buildBudget(), [
      buildTransaction(25_000),
    ]);

    expect(usage.state).toBe("exceeded");
    expect(usage.remainingMinor).toBe(-5_000);
    expect(usage.ratio).toBeCloseTo(1.25);
    expect(usage.summary).toBe(
      "Das Budget ist aufgebraucht; darüber hinaus sind weitere Ausgaben gebucht.",
    );
  });

  it("separates an exactly reached budget from an exceeded one", () => {
    const usage = calculateBudgetUsage(buildBudget(), [
      buildTransaction(20_000),
    ]);

    expect(usage.state).toBe("reached");
    expect(usage.remainingMinor).toBe(0);
    expect(usage.summary).toBe("Das Budget ist genau aufgebraucht.");
  });

  it("handles a zero budget without dividing by zero", () => {
    const empty = calculateBudgetUsage(
      buildBudget({ limit: { amountMinor: 0, currency: "EUR" } }),
      [],
    );
    expect(empty.ratio).toBeNull();
    expect(empty.state).toBe("within");
    expect(empty.summary).toBe(
      "Für diese Kategorie ist kein Betrag vorgesehen.",
    );

    const spent = calculateBudgetUsage(
      buildBudget({ limit: { amountMinor: 0, currency: "EUR" } }),
      [buildTransaction(500)],
    );
    expect(spent.ratio).toBeNull();
    expect(spent.state).toBe("exceeded");
    expect(spent.remainingMinor).toBe(-500);
  });

  it("stays at zero spending when the month has no booking", () => {
    const usage = calculateBudgetUsage(buildBudget({ month: "2026-09" }), [
      buildTransaction(5_000),
    ]);

    expect(usage.spentMinor).toBe(0);
    expect(usage.remainingMinor).toBe(20_000);
    expect(usage.transactionCount).toBe(0);
  });

  it("refuses to aggregate mixed currencies instead of converting", () => {
    expect(() =>
      calculateBudgetUsage(buildBudget(), [
        buildTransaction(1_000, {
          money: { amountMinor: 1_000, currency: "USD" },
        }),
      ]),
    ).toThrow(MixedCurrencyError);
  });
});

describe("findBudget", () => {
  it("ignores archived budgets and other months", () => {
    const budgets = [
      buildBudget({ archivedAt: "2026-08-02T08:00:00.000Z" }),
      buildBudget({
        id: "00000000-0000-4000-8000-000000005202",
        month: "2026-07",
      }),
    ];

    expect(findBudget(budgets, "2026-08", groceriesId)).toBeUndefined();

    const active = buildBudget({ id: "00000000-0000-4000-8000-000000005203" });
    expect(findBudget([...budgets, active], "2026-08", groceriesId)).toBe(
      active,
    );
  });
});

describe("month helpers", () => {
  it("reduces a day to its month", () => {
    expect(monthOfDay("2026-08-04")).toBe("2026-08");
  });

  it("crosses the year boundary in both directions", () => {
    expect(shiftMonth("2026-08", 1)).toBe("2026-09");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-01", -13)).toBe("2024-12");
  });
});
