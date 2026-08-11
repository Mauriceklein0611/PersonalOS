import type { PersonalOsDatabase } from "../../db/database";
import type {
  FinanceCategory,
  MonthlyBudget,
  Transaction,
} from "../../domains/finance/model";
import type { Habit, HabitEntry } from "../../domains/habits/model";
import type { JournalEntry } from "../../domains/journal/model";
import type { Task } from "../../domains/tasks/model";
import { addCalendarDays } from "../../lib/dates/calendar-days";
import type { CalendarDay } from "../../lib/dates/date-values";

/**
 * Ein synthetischer Datenbestand über mehrere Jahre, Issue #28.
 *
 * Er ist **kein** Nutzerdatenexport und darf keiner werden: Jede Zahl entsteht
 * aus dem Laufindex, jeder Text nennt sich selbst synthetisch. Der Bestand
 * beantwortet genau eine Frage — bleibt die App schnell, wenn jemand sie
 * mehrere Jahre lang benutzt hat?
 *
 * Die Größen entsprechen einer täglichen Nutzung über drei Jahre: zwei bis
 * drei Aufgaben am Tag, zwanzig Routinen mit lückenhafter Historie, ein
 * Journaleintrag je Tag und rund drei Buchungen je Tag.
 */
export type LargeDatasetOptions = {
  /** Letzter Tag des Bestands; von dort läuft er rückwärts. */
  today?: CalendarDay;
  days?: number;
  habitCount?: number;
  tasksPerDay?: number;
  transactionsPerDay?: number;
};

export type LargeDataset = {
  categories: FinanceCategory[];
  habitEntries: HabitEntry[];
  habits: Habit[];
  journalEntries: JournalEntry[];
  monthlyBudgets: MonthlyBudget[];
  tasks: Task[];
  today: CalendarDay;
  transactions: Transaction[];
};

const instant = "2026-01-15T09:30:00.000Z";

/** Erzeugt eine gültige, aber offensichtlich synthetische Kennung. */
function syntheticId(prefix: number, index: number): string {
  return `${String(prefix).padStart(8, "0")}-0000-4000-8000-${String(
    index,
  ).padStart(12, "0")}`;
}

export function buildLargeDataset(
  options: LargeDatasetOptions = {},
): LargeDataset {
  const {
    days = 1_095,
    habitCount = 20,
    tasksPerDay = 3,
    today = "2026-08-11",
    transactionsPerDay = 3,
  } = options;

  const firstDay = addCalendarDays(today, -(days - 1));
  const allDays = Array.from({ length: days }, (_, index) =>
    addCalendarDays(firstDay, index),
  );

  const categories: FinanceCategory[] = Array.from(
    { length: 12 },
    (_, index) => ({
      id: syntheticId(1, index),
      createdAt: instant,
      updatedAt: instant,
      kind: index % 4 === 0 ? "income" : "expense",
      name: `Synthetische Kategorie ${index + 1}`,
      ...(index % 5 === 0 ? { isFixedCost: true } : {}),
    }),
  );

  const habits: Habit[] = Array.from({ length: habitCount }, (_, index) => ({
    id: syntheticId(2, index),
    createdAt: instant,
    updatedAt: instant,
    name: `Synthetische Routine ${index + 1}`,
    schedule:
      index % 3 === 0
        ? { kind: "daily" }
        : index % 3 === 1
          ? { kind: "weekdays", days: [1, 3, 5] }
          : { kind: "timesPerWeek", count: 3 },
    startDate: firstDay,
  }));

  /*
   * Lückenhaft mit Absicht: Ein Bestand, in dem jede Routine an jedem Tag
   * einen Eintrag hat, ist unrealistisch und verbirgt genau die Abfragen, die
   * über fehlende Tage stolpern.
   */
  const habitEntries: HabitEntry[] = [];
  let entryIndex = 0;
  for (const [dayIndex, localDate] of allDays.entries()) {
    for (const [index, habit] of habits.entries()) {
      if ((dayIndex + index) % 4 === 0) continue;
      habitEntries.push({
        id: syntheticId(3, entryIndex++),
        createdAt: instant,
        updatedAt: instant,
        habitId: habit.id,
        localDate,
        status: (dayIndex + index) % 7 === 0 ? "skipped" : "done",
      });
    }
  }

  const journalEntries: JournalEntry[] = allDays.map((localDate, index) => ({
    id: syntheticId(4, index),
    createdAt: instant,
    updatedAt: instant,
    localDate,
    mood: (index % 5) + 1,
    energy: ((index + 1) % 5) + 1,
    stress: ((index + 2) % 5) + 1,
    productivity: ((index + 3) % 5) + 1,
    highlight: `Synthetischer Höhepunkt ${index + 1}`,
  }));

  const tasks: Task[] = [];
  let taskIndex = 0;
  for (const [dayIndex, plannedDate] of allDays.entries()) {
    for (let slot = 0; slot < tasksPerDay; slot += 1) {
      // Nur die letzten Tage bleiben offen; alles davor ist abgearbeitet.
      const isOpen = dayIndex >= days - 4;
      tasks.push({
        id: syntheticId(5, taskIndex++),
        createdAt: instant,
        updatedAt: instant,
        title: `Synthetische Aufgabe ${taskIndex}`,
        status: isOpen ? "open" : "completed",
        priority: slot === 0 ? "high" : slot === 1 ? "normal" : "low",
        plannedDate,
        estimatedMinutes: 15 * (slot + 1),
        ...(isOpen ? {} : { completedAt: instant }),
      });
    }
  }

  const transactions: Transaction[] = [];
  let transactionIndex = 0;
  for (const [dayIndex, bookedOn] of allDays.entries()) {
    for (let slot = 0; slot < transactionsPerDay; slot += 1) {
      const category = categories[(dayIndex + slot) % categories.length]!;
      transactions.push({
        id: syntheticId(6, transactionIndex++),
        createdAt: instant,
        updatedAt: instant,
        kind: category.kind,
        categoryId: category.id,
        bookedOn,
        money: {
          amountMinor: 500 + ((dayIndex + slot) % 90) * 100,
          currency: "EUR",
        },
      });
    }
  }

  const months = [...new Set(allDays.map((day) => day.slice(0, 7)))];
  const expenseCategories = categories.filter(
    (category) => category.kind === "expense",
  );
  const monthlyBudgets: MonthlyBudget[] = months.flatMap((month, monthIndex) =>
    expenseCategories.map((category, index) => ({
      id: syntheticId(7, monthIndex * expenseCategories.length + index),
      createdAt: instant,
      updatedAt: instant,
      month,
      categoryId: category.id,
      limit: { amountMinor: 20_000 + index * 1_000, currency: "EUR" },
    })),
  );

  return {
    categories,
    habitEntries,
    habits,
    journalEntries,
    monthlyBudgets,
    tasks,
    today,
    transactions,
  };
}

/**
 * Schreibt den Bestand direkt in die Tabellen. Der Weg über die Services
 * würde jeden Datensatz einzeln prüfen und wäre für 40.000 Datensätze so
 * langsam, dass der Test nicht mehr liefe; geprüft wird hier die Abfrage,
 * nicht das Schreiben.
 */
export async function seedLargeDataset(
  database: PersonalOsDatabase,
  dataset: LargeDataset,
): Promise<void> {
  await Promise.all([
    database.table("financeCategories").bulkAdd(dataset.categories),
    database.table("habits").bulkAdd(dataset.habits),
    database.table("habitEntries").bulkAdd(dataset.habitEntries),
    database.table("journalEntries").bulkAdd(dataset.journalEntries),
    database.table("monthlyBudgets").bulkAdd(dataset.monthlyBudgets),
    database.table("tasks").bulkAdd(dataset.tasks),
    database.table("transactions").bulkAdd(dataset.transactions),
  ]);
}
