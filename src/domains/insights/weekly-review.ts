import {
  addCalendarDays,
  getIsoWeekBounds,
} from "../../lib/dates/calendar-days";
import type { CalendarDay } from "../../lib/dates/date-values";
import { createMoney, formatMoney } from "../../lib/money/money";
import type { Transaction } from "../finance/model";
import { calculateHabitFulfillment } from "../habits/metrics";
import type { Habit, HabitEntry } from "../habits/model";
import type { Goal, GoalMilestone } from "../goals/model";
import type { JournalEntry } from "../journal/model";
import type { Task } from "../tasks/model";
import type { InsightPeriod } from "./insight-model";

/**
 * Eine Kennzahl der Woche. `ratio` ist `null`, wenn es keine Grundlage gibt —
 * niemals 0. `basis` nennt, worauf die Zahl beruht; ohne sie wäre die Zahl
 * eine Behauptung.
 */
export type WeeklyFigure = {
  basis: string;
  ratio: number | null;
  sourceCount: number;
  valueText: string;
};

export type WeeklyReview = {
  finance: WeeklyFigure;
  goals: WeeklyFigure;
  habits: WeeklyFigure;
  journal: WeeklyFigure;
  period: InsightPeriod;
  tasks: WeeklyFigure;
};

export type WeeklyReviewInput = {
  goals: readonly Goal[];
  habitEntries: readonly HabitEntry[];
  habits: readonly Habit[];
  journalEntries: readonly JournalEntry[];
  milestones: readonly GoalMilestone[];
  tasks: readonly Task[];
  transactions: readonly Transaction[];
};

/** Die ISO-Woche, in der der Tag liegt. Montag bis Sonntag. */
export function getWeekPeriod(day: CalendarDay): InsightPeriod {
  const [from, to] = getIsoWeekBounds(day);
  return { from, to };
}

export function shiftWeek(
  period: InsightPeriod,
  offset: number,
): InsightPeriod {
  return getWeekPeriod(addCalendarDays(period.from, offset * 7));
}

/**
 * Der Tag, für den Score und Regeln in dieser Woche rechnen: das Wochenende,
 * aber nie in der Zukunft. Eine laufende Woche wird bis heute ausgewertet.
 */
export function getReviewAnchorDay(
  period: InsightPeriod,
  today: CalendarDay,
): CalendarDay {
  return period.to > today ? today : period.to;
}

/**
 * Verdichtet eine Woche je Bereich. Die Funktion liest ausschließlich und
 * zeigt keine Freitexte: Aus dem Journal geht nur die Anzahl der Tage ein.
 */
export function buildWeeklyReview(
  input: WeeklyReviewInput,
  period: InsightPeriod,
): WeeklyReview {
  return {
    finance: summariseFinance(input.transactions, period),
    goals: summariseGoals(input.goals, input.milestones, period),
    habits: summariseHabits(input.habits, input.habitEntries, period),
    journal: summariseJournal(input.journalEntries, period),
    period,
    tasks: summariseTasks(input.tasks, period),
  };
}

function summariseTasks(
  tasks: readonly Task[],
  period: InsightPeriod,
): WeeklyFigure {
  const planned = tasks.filter(
    (task) =>
      task.archivedAt === undefined &&
      task.status !== "cancelled" &&
      task.plannedDate !== undefined &&
      task.plannedDate >= period.from &&
      task.plannedDate <= period.to,
  );
  const completed = planned.filter((task) => task.status === "completed");

  if (planned.length === 0) {
    return {
      basis: "Für diese Woche war keine Aufgabe geplant.",
      ratio: null,
      sourceCount: 0,
      valueText: "Keine Angabe",
    };
  }

  return {
    basis: `Grundlage: ${planned.length} geplante Aufgaben.`,
    ratio: completed.length / planned.length,
    sourceCount: planned.length,
    valueText: `${completed.length} von ${planned.length}`,
  };
}

function summariseHabits(
  habits: readonly Habit[],
  entries: readonly HabitEntry[],
  period: InsightPeriod,
): WeeklyFigure {
  let done = 0;
  let skipped = 0;
  let target = 0;
  let habitCount = 0;

  for (const habit of habits) {
    if (habit.archivedAt !== undefined) continue;
    const fulfillment = calculateHabitFulfillment(
      habit,
      entries,
      period.from,
      period.to,
    );
    if (fulfillment.target === 0) continue;
    done += fulfillment.done;
    skipped += fulfillment.skipped;
    target += fulfillment.target;
    habitCount += 1;
  }

  if (target === 0) {
    return {
      basis: "In dieser Woche war keine Gewohnheit fällig.",
      ratio: null,
      sourceCount: 0,
      valueText: "Keine Angabe",
    };
  }

  const skippedNote = skipped === 0 ? "" : ` ${skipped} übersprungen.`;
  return {
    basis: `Grundlage: ${habitCount} Gewohnheiten, ${target} geplante Einheiten.${skippedNote}`,
    ratio: done / target,
    sourceCount: habitCount,
    valueText: `${done} von ${target}`,
  };
}

function summariseJournal(
  entries: readonly JournalEntry[],
  period: InsightPeriod,
): WeeklyFigure {
  // Nur die Anzahl der Tage. Reflexionstexte bleiben in der Wochenübersicht
  // ungelesen und ungezeigt.
  const days = new Set(
    entries
      .filter(
        (entry) =>
          entry.archivedAt === undefined &&
          entry.localDate >= period.from &&
          entry.localDate <= period.to,
      )
      .map((entry) => entry.localDate),
  );

  return {
    basis:
      days.size === 0
        ? "In dieser Woche gibt es keinen Eintrag."
        : "Grundlage: Tage mit mindestens einem Eintrag.",
    ratio: days.size / 7,
    sourceCount: days.size,
    valueText: `${days.size} von 7 Tagen`,
  };
}

function summariseGoals(
  goals: readonly Goal[],
  milestones: readonly GoalMilestone[],
  period: InsightPeriod,
): WeeklyFigure {
  const active = goals.filter(
    (goal) => goal.archivedAt === undefined && goal.status === "active",
  );
  const activeIds = new Set(active.map((goal) => goal.id));
  const completedInWeek = milestones.filter(
    (milestone) =>
      milestone.archivedAt === undefined &&
      milestone.status === "completed" &&
      milestone.completedAt !== undefined &&
      activeIds.has(milestone.goalId) &&
      milestone.completedAt.slice(0, 10) >= period.from &&
      milestone.completedAt.slice(0, 10) <= period.to,
  );

  if (active.length === 0) {
    return {
      basis: "Es ist kein Ziel aktiv.",
      ratio: null,
      sourceCount: 0,
      valueText: "Keine Angabe",
    };
  }

  return {
    basis: `Grundlage: ${active.length} aktive Ziele.`,
    ratio: null,
    sourceCount: active.length,
    valueText: `${completedInWeek.length} Meilensteine`,
  };
}

function summariseFinance(
  transactions: readonly Transaction[],
  period: InsightPeriod,
): WeeklyFigure {
  const inWeek = transactions.filter(
    (transaction) =>
      transaction.archivedAt === undefined &&
      transaction.kind === "expense" &&
      transaction.bookedOn >= period.from &&
      transaction.bookedOn <= period.to,
  );

  if (inWeek.length === 0) {
    return {
      basis: "In dieser Woche ist keine Ausgabe gebucht.",
      ratio: null,
      sourceCount: 0,
      valueText: "Keine Angabe",
    };
  }

  const currencies = new Set(inWeek.map((entry) => entry.money.currency));
  if (currencies.size > 1) {
    return {
      basis:
        "Die Buchungen verwenden verschiedene Währungen. Eine Summe wäre nur mit einer Umrechnung möglich.",
      ratio: null,
      sourceCount: inWeek.length,
      valueText: "Keine Angabe",
    };
  }

  const [currency] = [...currencies];
  const amountMinor = inWeek.reduce(
    (total, entry) => total + entry.money.amountMinor,
    0,
  );

  return {
    basis: `Grundlage: ${inWeek.length} ${inWeek.length === 1 ? "Ausgabe" : "Ausgaben"} dieser Woche.`,
    ratio: null,
    sourceCount: inWeek.length,
    valueText: formatMoney(createMoney(amountMinor, currency!)),
  };
}
