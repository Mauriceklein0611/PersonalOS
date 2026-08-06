import { describe, expect, it } from "vitest";

import {
  addCalendarDays,
  enumerateCalendarDays,
  getIsoWeekday,
} from "../../lib/dates/calendar-days";
import type { CalendarDay } from "../../lib/dates/date-values";
import type { MonthlyBudget, Transaction } from "../finance/model";
import type { Habit, HabitEntry } from "../habits/model";
import type { Task } from "../tasks/model";
import {
  budgetPaceRule,
  getHabitRulePeriod,
  habitWeekdayRhythmRule,
  taskWeekdayPatternRule,
  type InsightInput,
} from "./insight-rules";

/** Alle Daten sind erfunden. */
const id = (suffix: string) => `00000000-0000-4000-8000-${suffix}`;
const instant = "2026-05-01T08:00:00.000Z";
let counter = 0;
const meta = () => {
  counter += 1;
  return {
    createdAt: instant,
    id: id(String(700_000_000_000 + counter)),
    updatedAt: instant,
  };
};

const today: CalendarDay = "2026-08-20";
const context = { timeZone: "Europe/Berlin", today };

const emptyInput: InsightInput = {
  budgets: [],
  habitEntries: [],
  habits: [],
  tasks: [],
  transactions: [],
};

function dailyHabit(name: string, startDate: CalendarDay): Habit {
  return { ...meta(), name, schedule: { kind: "daily" }, startDate };
}

function entry(habitId: string, localDate: CalendarDay): HabitEntry {
  return { ...meta(), habitId, localDate, status: "done" };
}

function task(
  plannedDate: CalendarDay,
  status: Task["status"],
  title = "Synthetische Aufgabe",
): Task {
  return {
    ...meta(),
    plannedDate,
    priority: "normal",
    status,
    title,
    ...(status === "completed"
      ? { completedAt: "2026-08-19T17:00:00.000Z" }
      : {}),
  };
}

function budget(amountMinor: number): MonthlyBudget {
  return {
    ...meta(),
    categoryId: id("000000007001"),
    limit: { amountMinor, currency: "EUR" },
    month: "2026-08",
  };
}

function expense(amountMinor: number, bookedOn: CalendarDay): Transaction {
  return {
    ...meta(),
    bookedOn,
    categoryId: id("000000007001"),
    kind: "expense",
    money: { amountMinor, currency: "EUR" },
  };
}

describe("habitWeekdayRhythmRule", () => {
  const period = getHabitRulePeriod(today);
  const days = enumerateCalendarDays(period.from, period.to);

  function buildHabits(startDate: CalendarDay = "2026-01-01") {
    const first = dailyHabit("Dehnen", startDate);
    const second = dailyHabit("Lesen", startDate);
    return [first, second];
  }

  it("looks at the six complete weeks before the current one", () => {
    expect(days).toHaveLength(42);
    expect(getIsoWeekday(period.from)).toBe(1);
    expect(getIsoWeekday(period.to)).toBe(7);
    expect(addCalendarDays(period.to, 1) <= today).toBe(true);
  });

  it("reports a clear weekday rhythm as a high observation", () => {
    const habits = buildHabits();
    const entries = habits.flatMap((habit) =>
      days
        .filter((day) => getIsoWeekday(day) <= 5)
        .map((day) => entry(habit.id, day)),
    );

    const [insight] = habitWeekdayRhythmRule.run(
      { ...emptyInput, habitEntries: entries, habits },
      context,
    );

    expect(insight.strength).toBe("high");
    expect(insight.message).toBe(
      "In 6 der letzten 6 vergleichbaren Wochen lag deine Erfüllung an Werktagen höher als am Wochenende.",
    );
    expect(insight.evidence).toContainEqual({
      metric: "comparableWeeks",
      sourceCount: 2,
      value: 6,
    });
    // Beobachtung, keine Ursache und keine Eigenschaftszuschreibung.
    expect(insight.message).not.toMatch(/weil|deshalb|solltest|diszipliniert/i);
  });

  it("names the missing basis instead of claiming a pattern", () => {
    // Startet erst zwei Wochen vor Ende: nur zwei vergleichbare Wochen.
    const habits = buildHabits(addCalendarDays(period.to, -13));
    const [insight] = habitWeekdayRhythmRule.run(
      { ...emptyInput, habits },
      context,
    );

    expect(insight.strength).toBe("low");
    expect(insight.message).toBe(
      "Für einen Vergleich zwischen Werktagen und Wochenende fehlen noch Daten: Es liegen 2 von mindestens 4 vergleichbaren Wochen vor.",
    );
  });

  it("stays silent without any habit", () => {
    expect(habitWeekdayRhythmRule.run(emptyInput, context)).toEqual([]);
  });

  it("leaves a timesPerWeek habit out instead of inventing a daily target", () => {
    const [habit] = buildHabits();
    const weekly: Habit = {
      ...habit,
      schedule: { kind: "timesPerWeek", count: 3 },
    };

    expect(
      habitWeekdayRhythmRule.run({ ...emptyInput, habits: [weekly] }, context),
    ).toEqual([]);
  });
});

describe("budgetPaceRule", () => {
  it("observes a budget that runs ahead of the month", () => {
    // 20 von 31 Tagen sind 65 %; gebucht sind 90 % von 300,00 €.
    const [insight] = budgetPaceRule.run(
      {
        ...emptyInput,
        budgets: [budget(30_000)],
        transactions: [
          expense(9_000, "2026-08-03"),
          expense(9_000, "2026-08-10"),
          expense(9_000, "2026-08-17"),
        ],
      },
      context,
    );

    expect(insight.strength).toBe("medium");
    expect(insight.message).toBe(
      "Nach 20 von 31 Tagen sind 90 % dieses Budgets gebucht.",
    );
    expect(insight.action).toEqual({
      kind: "open-budget",
      targetId: id("000000007001"),
    });
    expect(insight.message).not.toMatch(/solltest|Achtung|zu viel/i);
  });

  it("marks an exhausted budget as clearly recognisable", () => {
    const [insight] = budgetPaceRule.run(
      {
        ...emptyInput,
        budgets: [budget(30_000)],
        transactions: [
          expense(12_000, "2026-08-03"),
          expense(12_000, "2026-08-10"),
          expense(12_000, "2026-08-17"),
        ],
      },
      context,
    );

    expect(insight.strength).toBe("high");
  });

  it("stays silent while the budget follows the elapsed time", () => {
    expect(
      budgetPaceRule.run(
        {
          ...emptyInput,
          budgets: [budget(30_000)],
          transactions: [
            expense(6_000, "2026-08-03"),
            expense(6_000, "2026-08-10"),
            expense(6_000, "2026-08-17"),
          ],
        },
        context,
      ),
    ).toEqual([]);
  });

  it("stays silent below the minimum number of bookings", () => {
    expect(
      budgetPaceRule.run(
        {
          ...emptyInput,
          budgets: [budget(30_000)],
          transactions: [expense(27_000, "2026-08-03")],
        },
        context,
      ),
    ).toEqual([]);
  });

  it("stays silent in the first days of a month", () => {
    expect(
      budgetPaceRule.run(
        {
          ...emptyInput,
          budgets: [budget(30_000)],
          transactions: [
            expense(9_000, "2026-08-01"),
            expense(9_000, "2026-08-02"),
            expense(9_000, "2026-08-03"),
          ],
        },
        { ...context, today: "2026-08-04" },
      ),
    ).toEqual([]);
  });
});

describe("taskWeekdayPatternRule", () => {
  const period = {
    from: addCalendarDays(today, -27),
    to: today,
  };

  function tasksByWeekday(strongWeekday: number, weakWeekday: number) {
    return enumerateCalendarDays(period.from, period.to).flatMap((day) => {
      const weekday = getIsoWeekday(day);
      if (weekday === strongWeekday) {
        return [0, 1, 2, 3, 4].map(() => task(day, "completed"));
      }
      if (weekday === weakWeekday) {
        return [0, 1, 2, 3, 4].map(() => task(day, "open"));
      }
      return [];
    });
  }

  it("names the strongest and the weakest weekday side by side", () => {
    const [insight] = taskWeekdayPatternRule.run(
      { ...emptyInput, tasks: tasksByWeekday(2, 5) },
      context,
    );

    expect(insight.strength).toBe("high");
    expect(insight.message).toBe(
      "Von deinen geplanten Aufgaben hast du dienstags 100 % abgeschlossen, freitags 0 %.",
    );
    expect(insight.message).not.toMatch(/weil|liegt an|solltest/i);
  });

  it("names the missing basis below the minimum number of tasks", () => {
    const [insight] = taskWeekdayPatternRule.run(
      { ...emptyInput, tasks: [task(today, "open"), task(today, "completed")] },
      context,
    );

    expect(insight.strength).toBe("low");
    expect(insight.message).toContain("2 von mindestens 20 geplanten Aufgaben");
  });

  it("stays silent without a single planned task", () => {
    expect(taskWeekdayPatternRule.run(emptyInput, context)).toEqual([]);
  });

  it("stays silent when the weekdays barely differ", () => {
    const tasks = enumerateCalendarDays(period.from, period.to).flatMap(
      (day) => {
        const weekday = getIsoWeekday(day);
        if (weekday !== 2 && weekday !== 5) return [];
        // Vier von fünf an beiden Tagen: kein nennenswerter Unterschied.
        return [0, 1, 2, 3, 4].map((index) =>
          task(day, index < 4 ? "completed" : "open"),
        );
      },
    );

    expect(
      taskWeekdayPatternRule.run({ ...emptyInput, tasks }, context),
    ).toEqual([]);
  });
});
