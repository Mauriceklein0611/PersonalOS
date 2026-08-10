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
import type { MonthlyBudget, Transaction } from "./model";
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

function buildTransactions(
  count: number,
  categoryCount: number,
): Transaction[] {
  return Array.from({ length: count }, (_, index) => ({
    archivedAt: undefined,
    bookedOn: `2026-0${(index % 2) + 7}-${String((index % 28) + 1).padStart(2, "0")}`,
    categoryId: `category-${index % categoryCount}`,
    createdAt: "2026-08-01T08:00:00.000Z",
    id: `transaction-${index}`,
    kind: index % 5 === 0 ? ("income" as const) : ("expense" as const),
    money: { amountMinor: 100 + (index % 900), currency: "EUR" },
    updatedAt: "2026-08-01T08:00:00.000Z",
  }));
}

function buildBudgets(count: number): MonthlyBudget[] {
  return Array.from({ length: count }, (_, index) => ({
    archivedAt: undefined,
    categoryId: `category-${index}`,
    createdAt: "2026-08-01T08:00:00.000Z",
    id: `budget-${index}`,
    limit: { amountMinor: 50_000, currency: "EUR" },
    month,
    updatedAt: "2026-08-01T08:00:00.000Z",
  }));
}

/**
 * Zählt, wie oft die Verdichtung einen Datensatz anfasst.
 *
 * Diese Größe ist der Kern von #97. Vorher maß der Test Wanduhrzeit gegen eine
 * feste Zahl (250 ms) und fiel unter paralleler Last zufällig um — bei 254,6 ms
 * gegen 250 ms, also knapp, ohne dass sich an der Auswertung etwas geändert
 * hätte. Ein Test, der jeden beliebigen PR rot färben kann, wird ignoriert und
 * schützt dann auch dort nicht mehr, wo er soll.
 *
 * Die Zahl der Zugriffe hängt allein am Algorithmus. Sie ist auf einem
 * ausgelasteten Runner dieselbe wie auf einer stillen Maschine, und sie zeigt
 * eine überproportionale Auswertung unmittelbar an, statt sie in eine
 * Zeitmessung zu übersetzen.
 */
function countingReads<T extends object>(records: readonly T[]) {
  let reads = 0;
  const watched = records.map(
    (record) =>
      new Proxy(record, {
        get(target, key, receiver) {
          reads += 1;
          return Reflect.get(target, key, receiver) as unknown;
        },
      }) as T,
  );
  return {
    reads: () => reads,
    watched,
  };
}

describe("monthly overview with a large local dataset", () => {
  /*
   * Die Verdichtung läuft bei jeder Änderung neu. Sie muss deshalb auch bei
   * realistisch vielen Buchungen in einem Zug durchlaufen, ohne dass die
   * Laufzeit mit der Zahl der Kategorien überproportional wächst.
   */
  it("reads a booking the same number of times, whatever the category count", () => {
    const measure = (categoryCount: number) => {
      const transactions = countingReads(
        buildTransactions(6_000, categoryCount),
      );
      const overview = buildMonthlyOverview({
        budgets: [],
        contributions: [],
        currency: "EUR",
        month,
        savingsGoals: [],
        transactions: transactions.watched,
      });
      return {
        overview,
        perTransaction: transactions.reads() / transactions.watched.length,
        total: transactions.reads(),
      };
    };

    const few = measure(4);
    const many = measure(40);

    /*
     * Der eigentliche Schutz: Zehnmal so viele Kategorien kosten nur einen
     * kleinen, festen Aufwand **je Kategorie** — den Ersteintrag im
     * Kategorienrang. Verdichtete die Auswertung je Kategorie erneut über alle
     * Buchungen, wüchse der Unterschied stattdessen mit der Zahl der Buchungen
     * und läge bei 6.000 Buchungen um Größenordnungen höher.
     */
    expect(many.total - few.total).toBeLessThanOrEqual(4 * (40 - 4));

    /*
     * Die Obergrenze hält den absoluten Aufwand fest. Gemessen sind 10,9
     * Zugriffe je Buchung: je ein Durchlauf für Archivstatus, Währung und
     * Monat, danach Einnahmen, Ausgaben, Sparfluss, Kategorienrang und
     * Vormonatsvergleich. Die Reserve bis 14 lässt Raum für einen weiteren
     * Durchlauf, ohne einen zweiten Rang über alle Buchungen zu verdecken.
     */
    expect(few.perTransaction).toBeLessThan(14);

    // Die Erwartung stammt aus den Daten selbst; eine feste Zahl würde nur
    // die Wechselwirkung der Streuung nachbauen.
    const expectedCategories = new Set(
      buildTransactions(6_000, 40)
        .filter(
          (entry) =>
            entry.kind === "expense" && entry.bookedOn.startsWith(month),
        )
        .map((entry) => entry.categoryId),
    );

    expect(many.overview.transactionCount).toBeGreaterThan(2_000);
    expect(many.overview.expenseByCategory).toHaveLength(
      expectedCategories.size,
    );
    expect(expectedCategories.size).toBeGreaterThan(10);
    expect(
      many.overview.expenseByCategory.map((share) => share.amountMinor),
    ).toEqual(
      [...many.overview.expenseByCategory]
        .map((share) => share.amountMinor)
        .sort((left, right) => right - left),
    );
  });

  /*
   * Der Budgetpfad war bisher überhaupt nicht gemessen: Der Test übergab
   * `budgets: []` und `summariseBudgets` kehrte sofort zurück. Dabei sucht
   * genau dieser Pfad je Ausgabe erneut linear durch die Budgets.
   *
   * Der Test schreibt diesen Stand nicht als Ziel fest, sondern nur seine
   * Form: Der Aufwand darf mit der Datenmenge wachsen, aber nicht schneller
   * als sie. Die inhaltlichen Budgets setzt #28.
   */
  it("keeps the budget lookup from growing faster than the data", () => {
    const measure = (transactionCount: number) => {
      const budgets = countingReads(buildBudgets(40));
      buildMonthlyOverview({
        budgets: budgets.watched,
        contributions: [],
        currency: "EUR",
        month,
        savingsGoals: [],
        transactions: buildTransactions(transactionCount, 40),
      });
      return budgets.reads();
    };

    const small = measure(3_000);
    const large = measure(6_000);

    expect(small).toBeGreaterThan(0);
    // Doppelte Datenmenge, höchstens doppelter Aufwand mit etwas Reserve für
    // die feste Grundlast. Ein quadratischer Rückschritt reißt das sofort.
    expect(large).toBeLessThanOrEqual(small * 2 + 200);
  });

  /*
   * Grober Rückhalt gegen eine Verlangsamung, die keine zusätzlichen Zugriffe
   * verursacht — etwa eine teure Formatierung je Buchung.
   *
   * Die Grenze ist bewusst weit gefasst, und zwar gegen die gemessene
   * Streuung, nicht gegen die reine Rechenzeit: Auf ruhiger Maschine braucht
   * die Verdichtung rund 25 ms, unter paralleler Last wurden 254,6 ms
   * beobachtet — das Zehnfache. Genau daran ist das alte Budget von 250 ms
   * gescheitert. 2.000 ms liegen noch einmal rund acht Mal über dieser
   * Beobachtung unter Last und fallen erst bei einem Rückschritt um eine
   * Größenordnung.
   */
  it("finishes several thousand bookings well inside a coarse ceiling", () => {
    const transactions = buildTransactions(6_000, 40);

    const startedAt = performance.now();
    buildMonthlyOverview({
      budgets: [],
      contributions: [],
      currency: "EUR",
      month,
      savingsGoals: [],
      transactions,
    });

    expect(performance.now() - startedAt).toBeLessThan(2_000);
  });
});
