import { describe, expect, it } from "vitest";

import { buildEntityMeta, buildMoney } from "../../test/factories/entity";
import {
  buildCategoryTrend,
  describeCategoryTrend,
  maximumTrendMonths,
} from "./category-trend";
import type { Transaction } from "./model";

const groceriesId = "00000000-0000-4000-8000-000000008001";
const rentId = "00000000-0000-4000-8000-000000008002";

let sequence = 0;

function transaction(
  amountMinor: number,
  bookedOn: string,
  categoryId = groceriesId,
  overrides: Partial<Transaction> = {},
): Transaction {
  sequence += 1;
  return {
    ...buildEntityMeta({
      id: `00000000-0000-4000-8000-0000000081${String(sequence).padStart(2, "0")}`,
    }),
    bookedOn,
    categoryId,
    kind: "expense",
    money: buildMoney({ amountMinor }),
    ...overrides,
  };
}

const money = (amountMinor: number) => `${(amountMinor / 100).toFixed(2)} €`;
const month = (value: string) => value;

describe("buildCategoryTrend", () => {
  it("covers twelve months up to the given one", () => {
    const trend = buildCategoryTrend({
      categoryId: groceriesId,
      transactions: [transaction(10_000, "2026-08-05")],
      untilMonth: "2026-08",
    });

    expect(trend.points).toHaveLength(maximumTrendMonths);
    expect(trend.points[0]!.month).toBe("2025-09");
    expect(trend.points[11]!.month).toBe("2026-08");
  });

  /**
   * Der Kern des Akzeptanzkriteriums: Ein Monat ohne jede Buchung ist eine
   * Lücke. Ein Monat mit Buchungen, aber ohne eine dieser Kategorie, ist eine
   * echte Null — dort wurde erfasst und hier eben nichts ausgegeben.
   */
  it("tells a month without any basis apart from a real zero", () => {
    const trend = buildCategoryTrend({
      categoryId: groceriesId,
      months: 3,
      transactions: [
        transaction(10_000, "2026-06-05"),
        // Juli: nur Miete, also erfasst — aber nichts für Lebensmittel.
        transaction(68_000, "2026-07-01", rentId),
        transaction(12_000, "2026-08-05"),
      ],
      untilMonth: "2026-08",
    });

    expect(trend.points).toEqual([
      { amountMinor: 10_000, month: "2026-06" },
      { amountMinor: 0, month: "2026-07" },
      { amountMinor: 12_000, month: "2026-08" },
    ]);
  });

  it("leaves a month with no booking at all as a gap", () => {
    const trend = buildCategoryTrend({
      categoryId: groceriesId,
      months: 3,
      transactions: [
        transaction(10_000, "2026-06-05"),
        transaction(12_000, "2026-08-05"),
      ],
      untilMonth: "2026-08",
    });

    expect(trend.points[1]).toEqual({ amountMinor: null, month: "2026-07" });
    expect(trend.monthsWithBasis).toBe(2);
  });

  it("ignores archived bookings and income", () => {
    const trend = buildCategoryTrend({
      categoryId: groceriesId,
      months: 1,
      transactions: [
        transaction(10_000, "2026-08-05"),
        transaction(5_000, "2026-08-06", groceriesId, {
          archivedAt: "2026-08-07T10:00:00.000Z",
        }),
        transaction(90_000, "2026-08-07", groceriesId, { kind: "income" }),
      ],
      untilMonth: "2026-08",
    });

    expect(trend.points[0]!.amountMinor).toBe(10_000);
  });
});

describe("describeCategoryTrend", () => {
  const build = (months: number, transactions: Transaction[]) =>
    buildCategoryTrend({
      categoryId: groceriesId,
      months,
      transactions,
      untilMonth: "2026-08",
    });

  it("says so when there is nothing at all", () => {
    expect(describeCategoryTrend(build(3, []), money, month)).toBe(
      "Für diesen Zeitraum ist keine Buchung erfasst.",
    );
  });

  // Eine Richtung aus einem einzigen Monat wäre keine.
  it("refuses a direction from a single month", () => {
    const text = describeCategoryTrend(
      build(3, [transaction(10_000, "2026-08-05")]),
      money,
      month,
    );

    expect(text).toContain("mindestens zwei Monate");
  });

  it("names the direction, both figures and the gaps", () => {
    const text = describeCategoryTrend(
      build(3, [
        transaction(10_000, "2026-06-05"),
        transaction(12_000, "2026-08-05"),
      ]),
      money,
      month,
    );

    expect(text).toContain("2026-08: 120.00 €");
    expect(text).toContain("höher als 2026-06 mit 100.00 €");
    expect(text).toContain("1 Monat hat keine Grundlage");
    // Keine Ursache, keine Bewertung.
    for (const word of ["weil", "deshalb", "zu viel", "solltest"]) {
      expect(text).not.toContain(word);
    }
  });

  it("calls an unchanged amount equally high instead of inventing a trend", () => {
    const text = describeCategoryTrend(
      build(2, [
        transaction(10_000, "2026-07-05"),
        transaction(10_000, "2026-08-05"),
      ]),
      money,
      month,
    );

    // „gleich hoch als“ wäre falsches Deutsch.
    expect(text).toContain("gleich hoch wie 2026-07");
  });
});
