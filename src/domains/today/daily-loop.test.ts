import { describe, expect, it } from "vitest";

import { addCalendarDays } from "../../lib/dates/calendar-days";
import type { Habit, HabitEntry } from "../habits/model";
import type { JournalEntry } from "../journal/model";
import type { Task } from "../tasks/model";
import {
  buildTodayOverview,
  createTodayContext,
  type TodayInput,
} from "./queries";

const baseInstant = "2026-01-01T08:00:00.000Z";

/**
 * Budget für die Verdichtung des Tagesablaufs. Gemessen wurden rund 33 ms auf
 * einem Entwicklungsrechner, zuvor rund 151 ms ohne zwischengespeicherte
 * `Intl.DateTimeFormat`-Instanzen. Das Budget liegt bewusst weit darüber: Es
 * soll eine Regression um Größenordnungen erkennen, nicht die Messstreuung
 * unter paralleler Testlast.
 */
const overviewBudgetMs = 1_000;

describe("daily loop across day changes", () => {
  it("moves due work to the next local day at midnight", () => {
    const input = createInput({
      habits: [createHabit("h1")],
      tasks: [createTask("t1", { plannedDate: "2026-08-04" })],
    });

    const evening = buildTodayOverview(
      input,
      createTodayContext(new Date("2026-08-04T20:00:00.000Z"), "Europe/Berlin"),
    );
    const afterMidnight = buildTodayOverview(
      input,
      createTodayContext(new Date("2026-08-04T22:30:00.000Z"), "Europe/Berlin"),
    );

    expect(evening.openTasks).toHaveLength(1);
    expect(evening.overdueTaskCount).toBe(0);
    expect(afterMidnight.openTasks).toHaveLength(1);
    expect(afterMidnight.overdueTaskCount).toBe(1);
    expect(afterMidnight.dueHabits).toHaveLength(1);
  });

  it("keeps the loop correct on both Berlin DST switch days", () => {
    const springForward = buildTodayOverview(
      createInput({
        entriesByHabit: new Map([
          ["h1", [createHabitEntry("h1", "2026-03-29")]],
        ]),
        habits: [createHabit("h1", { startDate: "2026-03-01" })],
        journalEntries: [createJournalEntry("2026-03-29", { mood: 3 })],
      }),
      createTodayContext(new Date("2026-03-29T00:30:00.000Z"), "Europe/Berlin"),
    );

    expect(springForward.habitSettledCount).toBe(1);
    expect(springForward.dueHabits).toHaveLength(0);
    expect(springForward.journal.hasEntryToday).toBe(true);
    expect(springForward.journal.lastMood?.ageInDays).toBe(0);

    const fallBack = buildTodayOverview(
      createInput({
        habits: [createHabit("h1", { startDate: "2026-10-01" })],
        journalEntries: [createJournalEntry("2026-10-24", { mood: 4 })],
      }),
      createTodayContext(new Date("2026-10-25T00:30:00.000Z"), "Europe/Berlin"),
    );

    expect(fallBack.dueHabits).toHaveLength(1);
    expect(fallBack.journal.hasEntryToday).toBe(false);
    expect(fallBack.journal.lastMood?.ageInDays).toBe(1);
  });

  it("stays fast with two years of synthetic data", () => {
    const habits = Array.from({ length: 40 }, (_, index) =>
      createHabit(`h${index}`, { startDate: "2025-01-01" }),
    );
    const entriesByHabit = new Map(
      habits.map((habit) => [
        habit.id,
        Array.from({ length: 30 }, (_, day) =>
          createHabitEntry(habit.id, addCalendarDays("2026-07-10", day)),
        ),
      ]),
    );
    const tasks = Array.from({ length: 3_000 }, (_, index) =>
      createTask(`t${index}`, {
        plannedDate: addCalendarDays("2025-01-01", index % 700),
        priority: index % 3 === 0 ? "high" : "normal",
        status: index % 4 === 0 ? "completed" : "open",
        ...(index % 4 === 0 ? { completedAt: "2026-08-04T09:00:00.000Z" } : {}),
      }),
    );
    const journalEntries = Array.from({ length: 730 }, (_, index) =>
      createJournalEntry(addCalendarDays("2024-09-01", index), {
        mood: (index % 5) + 1,
      }),
    );

    const context = createTodayContext(
      new Date("2026-08-04T09:00:00.000Z"),
      "Europe/Berlin",
    );
    const input = createInput({
      entriesByHabit,
      habits,
      journalEntries,
      tasks,
    });

    const startedAt = performance.now();
    const overview = buildTodayOverview(input, context);
    const elapsed = performance.now() - startedAt;

    expect(overview.openTasks.length).toBeGreaterThan(0);
    expect(overview.habitDueCount).toBe(40);
    expect(overview.journal.lastMood).toBeDefined();
    expect(elapsed).toBeLessThan(overviewBudgetMs);
  });
});

function createInput(overrides: Partial<TodayInput> = {}): TodayInput {
  return {
    entriesByHabit: new Map(),
    habits: [],
    journalEntries: [],
    tasks: [],
    ...overrides,
  };
}

function createTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    createdAt: baseInstant,
    updatedAt: baseInstant,
    title: `Aufgabe ${id}`,
    priority: "normal",
    status: "open",
    ...overrides,
  };
}

function createHabit(id: string, overrides: Partial<Habit> = {}): Habit {
  return {
    id,
    createdAt: baseInstant,
    updatedAt: baseInstant,
    name: `Gewohnheit ${id}`,
    schedule: { kind: "daily" },
    startDate: "2026-08-01",
    ...overrides,
  };
}

function createHabitEntry(habitId: string, localDate: string): HabitEntry {
  return {
    id: `${habitId}-${localDate}`,
    createdAt: baseInstant,
    updatedAt: baseInstant,
    habitId,
    localDate,
    status: "done",
  };
}

function createJournalEntry(
  localDate: string,
  fields: Partial<JournalEntry> = {},
): JournalEntry {
  return {
    id: `journal-${localDate}`,
    createdAt: baseInstant,
    updatedAt: baseInstant,
    localDate,
    ...fields,
  };
}
