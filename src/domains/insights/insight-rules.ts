import {
  addCalendarDays,
  getIsoWeekBounds,
  getIsoWeekday,
} from "../../lib/dates/calendar-days";
import type { CalendarDay } from "../../lib/dates/date-values";
import { calculateBudgetUsage, monthOfDay } from "../finance/budget";
import { MixedCurrencyError } from "../finance/mixed-currency";
import type { MonthlyBudget, Transaction } from "../finance/model";
import { calculateHabitFulfillment } from "../habits/metrics";
import type { Habit, HabitEntry } from "../habits/model";
import type { Task } from "../tasks/model";
import {
  createInsightId,
  formatPercent,
  type Insight,
  type InsightEvidence,
  type InsightPeriod,
} from "./insight-model";

export type InsightInput = {
  budgets: readonly MonthlyBudget[];
  habitEntries: readonly HabitEntry[];
  habits: readonly Habit[];
  tasks: readonly Task[];
  transactions: readonly Transaction[];
};

export type InsightContext = {
  timeZone: string;
  today: CalendarDay;
};

export type InsightRule = {
  id: string;
  version: string;
  run(input: InsightInput, context: InsightContext): Insight[];
};

const weekdayNames = [
  "montags",
  "dienstags",
  "mittwochs",
  "donnerstags",
  "freitags",
  "samstags",
  "sonntags",
];

// --- Regel 1: Werktage gegen Wochenende bei Gewohnheiten -------------------

const habitRuleWeeks = 6;
const minimumComparableWeeks = 4;
const minimumHabitTarget = 20;

export const habitWeekdayRhythmRule: InsightRule = {
  id: "habit-weekday-rhythm",
  // v2: Der Nenner sind seit ADR 0012 die zählenden Einheiten.
  version: "habit-weekday-rhythm-v2",
  run(input, context) {
    const period = getHabitRulePeriod(context.today);
    // `timesPerWeek` bleibt außen vor: Das Ziel gilt für die Woche und ist
    // nicht auf Tage verteilt. Eine Aufteilung würde ein Ziel erfinden.
    const habits = input.habits.filter(
      (habit) =>
        habit.archivedAt === undefined &&
        habit.schedule.kind !== "timesPerWeek",
    );
    if (habits.length === 0) return [];

    let comparableWeeks = 0;
    let weekdayHigher = 0;
    let weekendHigher = 0;
    let totalTarget = 0;

    for (const weekStart of enumerateWeekStarts(period)) {
      const weekday = sumFulfillment(
        habits,
        input.habitEntries,
        weekStart,
        addCalendarDays(weekStart, 4),
      );
      const weekend = sumFulfillment(
        habits,
        input.habitEntries,
        addCalendarDays(weekStart, 5),
        addCalendarDays(weekStart, 6),
      );
      totalTarget += weekday.target + weekend.target;
      if (weekday.counted === 0 || weekend.counted === 0) continue;

      comparableWeeks += 1;
      const weekdayRate = weekday.done / weekday.counted;
      const weekendRate = weekend.done / weekend.counted;
      if (weekdayRate > weekendRate) weekdayHigher += 1;
      if (weekendRate > weekdayRate) weekendHigher += 1;
    }

    const evidence: InsightEvidence[] = [
      {
        metric: "comparableWeeks",
        sourceCount: habits.length,
        value: comparableWeeks,
      },
      {
        metric: "plannedUnits",
        sourceCount: habits.length,
        value: totalTarget,
      },
    ];

    if (
      comparableWeeks < minimumComparableWeeks ||
      totalTarget < minimumHabitTarget
    ) {
      return [
        {
          evidence,
          id: createInsightId(this.id, this.version, period),
          message: `Für einen Vergleich zwischen Werktagen und Wochenende fehlen noch Daten: Es liegen ${comparableWeeks} von mindestens ${minimumComparableWeeks} vergleichbaren Wochen vor.`,
          period,
          ruleId: this.id,
          ruleVersion: this.version,
          strength: "low",
        },
      ];
    }

    const weekdayWins = weekdayHigher >= weekendHigher;
    const dominant = weekdayWins ? weekdayHigher : weekendHigher;
    if (dominant < minimumComparableWeeks) return [];

    return [
      {
        evidence: [
          ...evidence,
          {
            metric: weekdayWins ? "weeksWeekdayHigher" : "weeksWeekendHigher",
            sourceCount: comparableWeeks,
            value: dominant,
          },
        ],
        id: createInsightId(this.id, this.version, period),
        message: weekdayWins
          ? `In ${dominant} der letzten ${comparableWeeks} vergleichbaren Wochen lag deine Erfüllung an Werktagen höher als am Wochenende.`
          : `In ${dominant} der letzten ${comparableWeeks} vergleichbaren Wochen lag deine Erfüllung am Wochenende höher als an Werktagen.`,
        period,
        ruleId: this.id,
        ruleVersion: this.version,
        strength: dominant >= habitRuleWeeks - 1 ? "high" : "medium",
      },
    ];
  },
};

/** Die sechs vollständigen ISO-Wochen vor der Woche des bewerteten Tages. */
export function getHabitRulePeriod(today: CalendarDay): InsightPeriod {
  const [currentWeekStart] = getIsoWeekBounds(today);
  const from = addCalendarDays(currentWeekStart, -7 * habitRuleWeeks);
  return { from, to: addCalendarDays(currentWeekStart, -1) };
}

function enumerateWeekStarts(period: InsightPeriod): CalendarDay[] {
  const starts: CalendarDay[] = [];
  for (let day = period.from; day <= period.to; day = addCalendarDays(day, 7)) {
    starts.push(day);
  }
  return starts;
}

/**
 * `counted` statt `target`: Übersprungene Einheiten sind seit
 * [ADR 0012](../../../docs/decisions/0012-skip-keeps-the-streak.md) nicht mehr
 * im Nenner. Ein Wochenende, das bewusst ausgelassen wurde, senkt die Quote
 * deshalb nicht mehr.
 */
function sumFulfillment(
  habits: readonly Habit[],
  entries: readonly HabitEntry[],
  from: CalendarDay,
  to: CalendarDay,
) {
  let counted = 0;
  let done = 0;
  let target = 0;
  for (const habit of habits) {
    const fulfillment = calculateHabitFulfillment(habit, entries, from, to);
    counted += fulfillment.counted;
    done += fulfillment.done;
    target += fulfillment.target;
  }
  return { counted, done, target };
}

// --- Regel 2: Budgetverbrauch gegen vergangene Zeit ------------------------

const minimumElapsedDays = 8;
const minimumBudgetTransactions = 3;
const budgetPaceMargin = 0.15;

export const budgetPaceRule: InsightRule = {
  id: "budget-pace",
  version: "budget-pace-v1",
  run(input, context) {
    const month = monthOfDay(context.today);
    const period = { from: `${month}-01`, to: context.today };
    const daysInMonth = getDaysInMonth(month);
    const elapsedDays = Number(context.today.slice(8, 10));
    const elapsedShare = elapsedDays / daysInMonth;

    const budgets = input.budgets.filter(
      (budget) =>
        budget.archivedAt === undefined &&
        budget.month === month &&
        budget.limit.amountMinor > 0,
    );

    return budgets.flatMap((budget) => {
      let usage;
      try {
        usage = calculateBudgetUsage(budget, input.transactions);
      } catch (error) {
        // Verschiedene Währungen werden benannt, nicht umgerechnet. Eine
        // Beobachtung darüber wäre erfunden, also entsteht keine.
        if (error instanceof MixedCurrencyError) return [];
        throw error;
      }

      const spentShare = usage.spentMinor / usage.limitMinor;
      const evidence: InsightEvidence[] = [
        {
          metric: "spentShare",
          sourceCount: usage.transactionCount,
          value: spentShare,
        },
        {
          metric: "elapsedShare",
          sourceCount: elapsedDays,
          value: elapsedShare,
        },
      ];
      const id = createInsightId(
        this.id,
        this.version,
        period,
        budget.categoryId,
      );

      if (
        elapsedDays < minimumElapsedDays ||
        usage.transactionCount < minimumBudgetTransactions
      ) {
        return [];
      }
      if (spentShare <= elapsedShare + budgetPaceMargin) return [];

      return [
        {
          action: { kind: "open-budget", targetId: budget.categoryId },
          evidence,
          id,
          message: `Nach ${elapsedDays} von ${daysInMonth} Tagen sind ${formatPercent(spentShare)} dieses Budgets gebucht.`,
          period,
          ruleId: this.id,
          ruleVersion: this.version,
          strength: spentShare >= 1 ? "high" : "medium",
        },
      ];
    });
  },
};

function getDaysInMonth(month: string): number {
  const [year = "1970", index = "01"] = month.split("-");
  return new Date(
    Date.UTC(Number.parseInt(year, 10), Number.parseInt(index, 10), 0),
  ).getUTCDate();
}

// --- Regel 3: Abschlussquote nach Wochentag --------------------------------

const taskRuleDays = 28;
const minimumPlannedTasks = 20;
const minimumTasksPerWeekday = 3;

export const taskWeekdayPatternRule: InsightRule = {
  id: "task-weekday-pattern",
  version: "task-weekday-pattern-v1",
  run(input, context) {
    const period = {
      from: addCalendarDays(context.today, 1 - taskRuleDays),
      to: context.today,
    };
    const planned = input.tasks.filter(
      (task) =>
        task.archivedAt === undefined &&
        task.status !== "cancelled" &&
        task.plannedDate !== undefined &&
        task.plannedDate >= period.from &&
        task.plannedDate <= period.to,
    );

    const byWeekday = new Map<number, { done: number; total: number }>();
    for (const task of planned) {
      const weekday = getIsoWeekday(task.plannedDate!);
      const current = byWeekday.get(weekday) ?? { done: 0, total: 0 };
      byWeekday.set(weekday, {
        done: current.done + (task.status === "completed" ? 1 : 0),
        total: current.total + 1,
      });
    }

    const eligible = [...byWeekday.entries()]
      .filter(([, counts]) => counts.total >= minimumTasksPerWeekday)
      .map(([weekday, counts]) => ({
        rate: counts.done / counts.total,
        total: counts.total,
        weekday,
      }))
      // Stabile Reihenfolge: bei gleicher Quote entscheidet der Wochentag.
      .sort(
        (left, right) => right.rate - left.rate || left.weekday - right.weekday,
      );

    const evidence: InsightEvidence[] = [
      {
        metric: "plannedTasks",
        sourceCount: planned.length,
        value: planned.length,
      },
      {
        metric: "comparableWeekdays",
        sourceCount: eligible.length,
        value: eligible.length,
      },
    ];

    if (planned.length < minimumPlannedTasks || eligible.length < 2) {
      if (planned.length === 0) return [];
      return [
        {
          evidence,
          id: createInsightId(this.id, this.version, period),
          message: `Für einen Vergleich zwischen Wochentagen fehlen noch Daten: Es liegen ${planned.length} von mindestens ${minimumPlannedTasks} geplanten Aufgaben vor.`,
          period,
          ruleId: this.id,
          ruleVersion: this.version,
          strength: "low",
        },
      ];
    }

    const best = eligible[0];
    const worst = eligible.at(-1)!;
    const difference = best.rate - worst.rate;
    if (difference < 0.25) return [];

    return [
      {
        evidence: [
          ...evidence,
          {
            metric: "highestWeekdayRate",
            sourceCount: best.total,
            value: best.rate,
          },
          {
            metric: "lowestWeekdayRate",
            sourceCount: worst.total,
            value: worst.rate,
          },
        ],
        id: createInsightId(this.id, this.version, period),
        message: `Von deinen geplanten Aufgaben hast du ${weekdayNames[best.weekday - 1]} ${formatPercent(best.rate)} abgeschlossen, ${weekdayNames[worst.weekday - 1]} ${formatPercent(worst.rate)}.`,
        period,
        ruleId: this.id,
        ruleVersion: this.version,
        strength: difference >= 0.5 ? "high" : "medium",
      },
    ];
  },
};

export const insightRules: readonly InsightRule[] = [
  habitWeekdayRhythmRule,
  budgetPaceRule,
  taskWeekdayPatternRule,
];
