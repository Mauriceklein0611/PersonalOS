import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createFinanceService } from "../domains/finance/service";
import {
  createFinanceCategoryRepository,
  createMonthlyBudgetRepository,
  createRecurringTransactionRepository,
  createTransactionRepository,
} from "../domains/finance/repository";
import { createHabitService } from "../domains/habits/service";
import {
  createHabitEntryRepository,
  createHabitRepository,
} from "../domains/habits/repository";
import { createJournalService } from "../domains/journal/service";
import { createJournalRepository } from "../domains/journal/repository";
import { createTaskService } from "../domains/tasks/service";
import { createTaskRepository } from "../domains/tasks/repository";
import { getIsoWeekBounds } from "../lib/dates/calendar-days";
import { createTestDatabase, deleteTestDatabase } from "../test/database";
import {
  buildLargeDataset,
  seedLargeDataset,
  type LargeDataset,
} from "../test/fixtures/large-dataset";
import {
  countDatabaseQueries,
  createQueryCounter,
  type QueryCounter,
} from "../test/query-counter";
import type { PersonalOsDatabase } from "./database";

/**
 * Abfragebudgets für einen mehrjährigen Bestand, Issue #28.
 *
 * Gemessen werden zwei deterministische Größen: die Zahl der Abfragen und die
 * Zahl der Datensätze, die sie aus dem Speicher holen. Die Begründung und die
 * gemessenen Werte stehen in `docs/PERFORMANCE.md`.
 */
let database: PersonalOsDatabase;
let dataset: LargeDataset;

beforeAll(async () => {
  dataset = buildLargeDataset();
  database = await createTestDatabase();
  await seedLargeDataset(database, dataset);
}, 120_000);

afterAll(async () => {
  await deleteTestDatabase(database);
});

function createServices() {
  const habitEntries = createHabitEntryRepository(database);
  return {
    finance: createFinanceService(
      createFinanceCategoryRepository(database),
      createTransactionRepository(database),
      createMonthlyBudgetRepository(database),
      createRecurringTransactionRepository(database),
    ),
    habits: createHabitService(createHabitRepository(database), habitEntries),
    journal: createJournalService(createJournalRepository(database)),
    tasks: createTaskService(createTaskRepository(database)),
  };
}

async function measure(
  run: (services: ReturnType<typeof createServices>) => Promise<unknown>,
): Promise<QueryCounter> {
  const counter = createQueryCounter();
  const restore = countDatabaseQueries(database, counter);
  try {
    await run(createServices());
  } finally {
    restore();
  }
  return counter;
}

describe("Abfragebudgets bei mehrjährigem Bestand", () => {
  it("builds a dataset of the documented size", () => {
    expect(dataset.tasks.length).toBe(3_285);
    expect(dataset.habitEntries.length).toBeGreaterThan(16_000);
    expect(dataset.journalEntries.length).toBe(1_095);
    expect(dataset.transactions.length).toBe(3_285);
  });

  /*
   * Der Ladeweg der Tagesübersicht, wie ihn `readTodaySnapshot` geht. Die
   * Zahl der Abfragen darf nicht mit der Zahl der Routinen wachsen: Vorher
   * fragte die Seite je Routine einzeln und stellte damit allein hier so
   * viele Abfragen, wie es Routinen gibt.
   */
  it("loads the dashboard with a fixed number of queries", async () => {
    const [weekStart] = getIsoWeekBounds(dataset.today);
    const counter = await measure(async (services) => {
      await Promise.all([
        services.tasks.list(),
        services.habits.list(),
        services.journal.list(),
        services.habits.listEntriesByHabit({
          from: weekStart,
          to: dataset.today,
        }),
      ]);
    });

    expect(counter.queries).toBeLessThanOrEqual(4);
    // Die Check-ins der Woche, nicht die von drei Jahren.
    expect(counter.rows).toBeLessThan(
      dataset.tasks.length +
        dataset.habits.length +
        dataset.journalEntries.length +
        200,
    );
  });

  it("reads one week of check-ins instead of the whole history", async () => {
    const [weekStart] = getIsoWeekBounds(dataset.today);
    const counter = await measure(async (services) => {
      const grouped = await services.habits.listEntriesByHabit({
        from: weekStart,
        to: dataset.today,
      });
      expect(grouped.size).toBeGreaterThan(0);
    });

    expect(counter.queries).toBe(1);
    // Sieben Tage × 20 Routinen sind die Obergrenze, die Lücken senken sie.
    expect(counter.rows).toBeLessThanOrEqual(7 * dataset.habits.length);
  });

  it("reads a single habit range through the compound index", async () => {
    const habitId = dataset.habits[0]!.id;
    const [weekStart] = getIsoWeekBounds(dataset.today);
    const counter = await measure(async (services) => {
      const entries = await services.habits.listEntries(habitId, {
        from: weekStart,
        to: dataset.today,
      });
      expect(entries.length).toBeGreaterThan(0);
    });

    expect(counter.queries).toBe(1);
    expect(counter.rows).toBeLessThanOrEqual(7);
  });

  /*
   * Die Routinenseite braucht die vollständige Historie für ihre Zeiträume.
   * Die Zahl der gelesenen Datensätze ist damit unvermeidbar; die Zahl der
   * Abfragen ist es nicht.
   */
  it("loads the whole check-in history with a single query", async () => {
    const counter = await measure(async (services) => {
      const grouped = await services.habits.listEntriesByHabit();
      expect(grouped.size).toBe(dataset.habits.length);
    });

    expect(counter.queries).toBe(1);
  });

  it("reads one week of journal entries instead of every year", async () => {
    const [weekStart] = getIsoWeekBounds(dataset.today);
    const counter = await measure(async (services) => {
      await services.journal.list({ from: weekStart, to: dataset.today });
    });

    expect(counter.queries).toBe(1);
    expect(counter.rows).toBeLessThanOrEqual(7);
  });

  /*
   * Der Finanzbereich liest den Monat, nicht die Historie. Die Monatsübersicht
   * rechnet auf dem Ergebnis weiter; was sie nie sieht, muss sie auch nicht
   * aus dem Speicher holen.
   */
  it("keeps the monthly finance view inside its query budget", async () => {
    const month = dataset.today.slice(0, 7);
    const counter = await measure(async (services) => {
      await Promise.all([
        services.finance.listCategories(),
        services.finance.listBudgets(month),
        services.finance.listTransactions({ month }),
      ]);
    });

    expect(counter.queries).toBeLessThanOrEqual(3);
    // Ein Monat sind rund 90 Buchungen, nicht die 3.285 des Bestands.
    expect(counter.rows).toBeLessThan(200);
  });
});
