import { describe, expect, it } from "vitest";

import type { Habit, HabitEntry } from "../habits/model";
import type { JournalEntry } from "../journal/model";
import type { Task } from "../tasks/model";
import {
  buildTodayOverview,
  createTodayContext,
  getGreeting,
  type TodayContext,
  type TodayInput,
} from "./queries";

const today = "2026-08-04";
const baseInstant = "2026-08-01T08:00:00.000Z";

describe("today queries", () => {
  it("puts overdue work first and names the most important task", () => {
    const overview = buildTodayOverview(
      createInput({
        tasks: [
          createTask("t1", { plannedDate: today, priority: "normal" }),
          createTask("t2", { plannedDate: "2026-08-01", priority: "low" }),
          createTask("t3", { plannedDate: today, priority: "high" }),
          createTask("t4", { plannedDate: "2026-08-06" }),
        ],
      }),
      createContext(),
    );

    expect(overview.openTasks.map((task) => task.id)).toEqual([
      "t2",
      "t3",
      "t1",
    ]);
    expect(overview.mostImportantTask?.id).toBe("t2");
    expect(overview.overdueTaskCount).toBe(1);
  });

  it("counts only tasks completed on the local day", () => {
    const overview = buildTodayOverview(
      createInput({
        tasks: [
          createTask("t1", {
            completedAt: "2026-08-04T05:00:00.000Z",
            status: "completed",
          }),
          createTask("t2", {
            completedAt: "2026-08-02T05:00:00.000Z",
            status: "completed",
          }),
        ],
      }),
      createContext(),
    );

    expect(overview.completedTaskCount).toBe(1);
  });

  it("separates due habits from those already recorded today", () => {
    const habits = [
      createHabit("h1"),
      createHabit("h2"),
      createHabit("h3", { schedule: { kind: "weekdays", days: [1] } }),
      createHabit("h4", { archivedAt: baseInstant }),
    ];
    const overview = buildTodayOverview(
      createInput({
        entriesByHabit: new Map([
          ["h2", [createHabitEntry("h2", today, "skipped")]],
        ]),
        habits,
      }),
      createContext(),
    );

    expect(overview.dueHabits.map((entry) => entry.habit.id)).toEqual(["h1"]);
    expect(overview.settledHabits.map((entry) => entry.habit.id)).toEqual([
      "h2",
    ]);
    expect(overview.habitDueCount).toBe(2);
    expect(overview.habitSettledCount).toBe(1);
  });

  it("marks an older mood as a past entry and keeps today's mood current", () => {
    const stale = buildTodayOverview(
      createInput({
        journalEntries: [createJournalEntry("2026-08-01", { mood: 2 })],
      }),
      createContext(),
    );
    expect(stale.journal.hasEntryToday).toBe(false);
    expect(stale.journal.lastMood).toEqual({
      ageInDays: 3,
      localDate: "2026-08-01",
      value: 2,
    });

    const current = buildTodayOverview(
      createInput({
        journalEntries: [
          createJournalEntry("2026-08-01", { mood: 2 }),
          createJournalEntry(today, { mood: 5, highlight: "Kurzer Text" }),
        ],
      }),
      createContext(),
    );
    expect(current.journal.hasEntryToday).toBe(true);
    expect(current.journal.lastMood?.ageInDays).toBe(0);
    expect(current.journal.filledFieldCount).toBe(2);
  });

  it("shows the evening hint only in the evening and only without an entry", () => {
    const evening = buildTodayOverview(
      createInput(),
      createContext({ hour: 20 }),
    );
    const morning = buildTodayOverview(
      createInput(),
      createContext({ hour: 8 }),
    );
    const eveningWithEntry = buildTodayOverview(
      createInput({
        journalEntries: [createJournalEntry(today, { mood: 3 })],
      }),
      createContext({ hour: 20 }),
    );

    expect(evening.journal.showEveningHint).toBe(true);
    expect(morning.journal.showEveningHint).toBe(false);
    expect(eveningWithEntry.journal.showEveningHint).toBe(false);
  });

  it("derives the local day and greeting from the given time zone", () => {
    const context = createTodayContext(
      new Date("2026-08-04T22:30:00.000Z"),
      "Europe/Berlin",
    );

    expect(context.today).toBe("2026-08-05");
    expect(context.hour).toBe(0);
    expect(getGreeting(context.hour)).toBe("morning");
    expect(getGreeting(12)).toBe("day");
    expect(getGreeting(18)).toBe("evening");
  });

  it("stays understandable on a completely empty day", () => {
    const overview = buildTodayOverview(createInput(), createContext());

    expect(overview.openTasks).toEqual([]);
    expect(overview.mostImportantTask).toBeUndefined();
    expect(overview.habitDueCount).toBe(0);
    expect(overview.journal.lastMood).toBeUndefined();
  });
});

describe("today capacity", () => {
  // Ohne eine einzige Schätzung gibt es keine Summe, statt einer Null.
  it("stays absent while no open task carries an estimate", () => {
    const overview = buildTodayOverview(
      createInput({
        tasks: [
          createTask("t1", { plannedDate: today }),
          createTask("t2", { plannedDate: today }),
        ],
      }),
      createContext(),
    );

    expect(overview.capacity).toBeUndefined();
  });

  // Ungeschätzte Aufgaben zählen mit — als eigene Zahl, nicht als null
  // Minuten. Sonst läse sich ein ungeschätzter Tag als leerer Tag.
  it("sums the estimates and counts the tasks without one separately", () => {
    const overview = buildTodayOverview(
      createInput({
        tasks: [
          createTask("t1", { estimatedMinutes: 45, plannedDate: today }),
          createTask("t2", { estimatedMinutes: 30, plannedDate: today }),
          createTask("t3", { plannedDate: today }),
        ],
      }),
      createContext(),
    );

    expect(overview.capacity).toEqual({
      budgetMinutes: undefined,
      estimatedTaskCount: 2,
      isOverBudget: false,
      totalMinutes: 75,
      unestimatedTaskCount: 1,
    });
  });

  it("reports no budget comparison while none is set", () => {
    const overview = buildTodayOverview(
      createInput({
        tasks: [
          createTask("t1", { estimatedMinutes: 600, plannedDate: today }),
        ],
      }),
      createContext(),
    );

    expect(overview.capacity?.budgetMinutes).toBeUndefined();
    expect(overview.capacity?.isOverBudget).toBe(false);
  });

  it("marks the sum as over the budget only once it exceeds it", () => {
    const build = (estimatedMinutes: number) =>
      buildTodayOverview(
        createInput({
          dailyCapacityMinutes: 120,
          tasks: [createTask("t1", { estimatedMinutes, plannedDate: today })],
        }),
        createContext(),
      ).capacity;

    expect(build(119)?.isOverBudget).toBe(false);
    // Genau auf dem Budget ist nicht darüber.
    expect(build(120)?.isOverBudget).toBe(false);
    expect(build(121)?.isOverBudget).toBe(true);
    expect(build(121)?.budgetMinutes).toBe(120);
  });

  // Die Summe beschreibt den heutigen Tag, nicht den Rest der Woche.
  it("ignores estimates of tasks that are not open today", () => {
    const overview = buildTodayOverview(
      createInput({
        tasks: [
          createTask("t1", { estimatedMinutes: 45, plannedDate: today }),
          createTask("t2", {
            estimatedMinutes: 90,
            plannedDate: "2026-08-07",
          }),
          createTask("t3", {
            completedAt: "2026-08-04T09:00:00.000Z",
            estimatedMinutes: 60,
            plannedDate: today,
            status: "completed",
          }),
        ],
      }),
      createContext(),
    );

    expect(overview.capacity?.totalMinutes).toBe(45);
    expect(overview.capacity?.estimatedTaskCount).toBe(1);
  });
});

function createContext(overrides: Partial<TodayContext> = {}): TodayContext {
  return { hour: 9, timeZone: "Europe/Berlin", today, ...overrides };
}

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

function createHabitEntry(
  habitId: string,
  localDate: string,
  status: HabitEntry["status"],
): HabitEntry {
  return {
    id: `${habitId}-${localDate}`,
    createdAt: baseInstant,
    updatedAt: baseInstant,
    habitId,
    localDate,
    status,
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
