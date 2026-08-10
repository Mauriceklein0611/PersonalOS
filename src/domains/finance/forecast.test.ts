import { describe, expect, it } from "vitest";

import { buildEntityMeta, buildMoney } from "../../test/factories/entity";
import { buildMonthForecast } from "./forecast";
import type { FinanceCategory, Transaction } from "./model";
import type { DueRecurringTransaction } from "./recurring";

const rentId = "00000000-0000-4000-8000-000000006001";
const groceriesId = "00000000-0000-4000-8000-000000006002";

const categories: FinanceCategory[] = [
  {
    ...buildEntityMeta({ id: rentId }),
    isFixedCost: true,
    kind: "expense",
    name: "Wohnen",
  },
  {
    ...buildEntityMeta({ id: groceriesId }),
    kind: "expense",
    name: "Lebensmittel",
  },
];

let sequence = 0;

function transaction(
  kind: Transaction["kind"],
  amountMinor: number,
  categoryId: string,
  bookedOn: string,
  overrides: Partial<Transaction> = {},
): Transaction {
  sequence += 1;
  return {
    ...buildEntityMeta({
      id: `00000000-0000-4000-8000-0000000062${String(sequence).padStart(2, "0")}`,
    }),
    bookedOn,
    categoryId,
    kind,
    money: buildMoney({ amountMinor }),
    ...overrides,
  };
}

function dueTemplate(
  amountMinor: number,
  categoryId: string,
  kind: Transaction["kind"] = "expense",
): DueRecurringTransaction {
  sequence += 1;
  return {
    proposedDate: "2026-08-28",
    template: {
      ...buildEntityMeta({
        id: `00000000-0000-4000-8000-0000000063${String(sequence).padStart(2, "0")}`,
      }),
      categoryId,
      dayOfMonth: 28,
      kind,
      money: buildMoney({ amountMinor }),
      name: "Synthetische Vorlage",
    },
  };
}

/** Juni und Juli mit je 300,00 bzw. 500,00 variablen Ausgaben. */
const history: Transaction[] = [
  transaction("expense", 30_000, groceriesId, "2026-06-10"),
  transaction("expense", 50_000, groceriesId, "2026-07-10"),
  transaction("expense", 68_000, rentId, "2026-06-01"),
  transaction("expense", 68_000, rentId, "2026-07-01"),
];

function build(
  overrides: Partial<Parameters<typeof buildMonthForecast>[0]> = {},
) {
  return buildMonthForecast({
    categories,
    dueTemplates: [],
    month: "2026-08",
    transactions: history,
    ...overrides,
  });
}

describe("buildMonthForecast", () => {
  // Eine Zahl aus einem einzigen Monat wäre keine Schätzung, sondern eine
  // Behauptung mit Nachkommastellen.
  it("gives no forecast below two completed months and names why", () => {
    expect(build({ transactions: [] })).toEqual({
      kind: "unavailable",
      reason: "Für eine Schätzung fehlt jeder abgeschlossene Monat.",
    });

    const single = build({
      transactions: [transaction("expense", 30_000, groceriesId, "2026-07-10")],
    });
    expect(single.kind).toBe("unavailable");
    if (single.kind === "unavailable") {
      expect(single.reason).toContain("2 abgeschlossene Monate");
      expect(single.reason).toContain("bisher liegt 1 vor");
    }
  });

  it("names the months the average is built from", () => {
    const forecast = build();

    expect(forecast.kind).toBe("available");
    if (forecast.kind !== "available") return;
    expect(forecast.basisMonths).toEqual(["2026-06", "2026-07"]);
    // (300,00 + 500,00) / 2 — die Miete ist Fixkosten und zählt nicht mit.
    expect(forecast.averageVariableMinor).toBe(40_000);
  });

  it("expects the gap to the average, not a second full month", () => {
    const forecast = build({
      transactions: [
        ...history,
        transaction("expense", 15_000, groceriesId, "2026-08-05"),
      ],
    });

    expect(forecast.kind).toBe("available");
    if (forecast.kind !== "available") return;
    expect(forecast.expectedRemainingVariableMinor).toBe(25_000);
    expect(forecast.expectedExpenseMinor).toBe(15_000 + 25_000);
  });

  // Liegt der Monat schon über dem Durchschnitt, wird nichts weiter erwartet
  // statt rückwirkend zu kürzen.
  it("never expects a negative remainder", () => {
    const forecast = build({
      transactions: [
        ...history,
        transaction("expense", 60_000, groceriesId, "2026-08-05"),
      ],
    });

    expect(forecast.kind).toBe("available");
    if (forecast.kind !== "available") return;
    expect(forecast.expectedRemainingVariableMinor).toBe(0);
    expect(forecast.expectedExpenseMinor).toBe(60_000);
  });

  it("adds the still open templates on both sides", () => {
    const forecast = build({
      dueTemplates: [
        dueTemplate(68_000, rentId),
        dueTemplate(240_000, groceriesId, "income"),
        // Eine Vorlage variabler Ausgaben ist keine sichere Fixkostenzahlung.
        dueTemplate(5_000, groceriesId),
      ],
      transactions: [
        ...history,
        transaction("income", 10_000, groceriesId, "2026-08-01"),
      ],
    });

    expect(forecast.kind).toBe("available");
    if (forecast.kind !== "available") return;
    expect(forecast.openFixedMinor).toBe(68_000);
    expect(forecast.openIncomeMinor).toBe(240_000);
    expect(forecast.expectedIncomeMinor).toBe(250_000);
    expect(forecast.expectedExpenseMinor).toBe(68_000 + 40_000);
    expect(forecast.expectedBalanceMinor).toBe(250_000 - 108_000);
  });

  it("leaves an archived booking out of the history", () => {
    const forecast = build({
      transactions: history.map((entry) =>
        entry.bookedOn === "2026-06-10"
          ? { ...entry, archivedAt: "2026-06-11T10:00:00.000Z" }
          : entry,
      ),
    });

    expect(forecast.kind).toBe("available");
    if (forecast.kind !== "available") return;
    // Juni zählt weiter als Monat (die Miete steht dort), aber ohne die 300,00.
    expect(forecast.basisMonths).toEqual(["2026-06", "2026-07"]);
    expect(forecast.averageVariableMinor).toBe(25_000);
  });
});
