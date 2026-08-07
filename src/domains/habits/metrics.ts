import {
  enumerateCalendarDays,
  getIsoWeekBounds,
} from "../../lib/dates/calendar-days";
import type { CalendarDay } from "../../lib/dates/date-values";
import type { Habit, HabitEntry } from "./model";
import { getHabitEligibleDays, isHabitEligibleOn } from "./schedule";

export type HabitFulfillment = {
  /**
   * Nenner der Quote: geplante Einheiten ohne die bewusst übersprungenen,
   * siehe [ADR 0012](../../../docs/decisions/0012-skip-keeps-the-streak.md).
   * Nie kleiner als `done`, damit die Quote 100 % nicht überschreiten kann.
   */
  counted: number;
  done: number;
  from: CalendarDay;
  rate: number | null;
  /** Noch offene zählende Einheiten. Übersprungene sind hier nicht enthalten. */
  remaining: number;
  skipped: number;
  /** Alle geplanten Einheiten, einschließlich der übersprungenen. */
  target: number;
  to: CalendarDay;
};

export type HabitStreak = {
  best: number;
  current: number;
  unit: "day" | "week";
};

export function calculateHabitFulfillment(
  habit: Habit,
  entries: readonly HabitEntry[],
  from: CalendarDay,
  to: CalendarDay,
): HabitFulfillment {
  assertRange(from, to);
  const visibleEntries = getVisibleEntries(habit, entries, from, to);

  let target = 0;
  let done = 0;
  let skipped = 0;
  let counted = 0;
  if (habit.schedule.kind === "timesPerWeek") {
    for (const period of getTimesPerWeekPeriods(habit, from, to)) {
      const periodEntries = visibleEntries.filter(
        (entry) =>
          entry.localDate >= period.start && entry.localDate <= period.end,
      );
      const periodDone = Math.min(
        period.target,
        periodEntries.filter((entry) => entry.status === "done").length,
      );
      const periodSkipped = periodEntries.filter(
        (entry) => entry.status === "skipped",
      ).length;
      target += period.target;
      done += periodDone;
      skipped += periodSkipped;
      counted += countedUnits(period.target, periodDone, periodSkipped);
    }
  } else {
    const dueDays = getHabitEligibleDays(habit, from, to);
    const dueDaySet = new Set(dueDays);
    const dueEntries = visibleEntries.filter((entry) =>
      dueDaySet.has(entry.localDate),
    );
    target = dueDays.length;
    done = dueEntries.filter((entry) => entry.status === "done").length;
    skipped = dueEntries.filter((entry) => entry.status === "skipped").length;
    counted = countedUnits(target, done, skipped);
  }

  return {
    counted,
    done,
    from,
    rate: counted === 0 ? null : done / counted,
    remaining: counted - done,
    skipped,
    target,
    to,
  };
}

/**
 * Ein Überspringen nimmt eine geplante Einheit aus dem Nenner, aber nie eine
 * bereits erledigte. Bei `timesPerWeek` kann ein Tag übersprungen und ein
 * anderer erledigt sein; ohne diese Untergrenze käme eine Quote über 100 %
 * heraus.
 */
function countedUnits(target: number, done: number, skipped: number): number {
  return Math.max(done, target - skipped);
}

export function calculateHabitStreak(
  habit: Habit,
  entries: readonly HabitEntry[],
  through: CalendarDay,
): HabitStreak {
  if (through < habit.startDate) {
    return {
      best: 0,
      current: 0,
      unit: habit.schedule.kind === "timesPerWeek" ? "week" : "day",
    };
  }
  return habit.schedule.kind === "timesPerWeek"
    ? calculateWeeklyStreak(habit, entries, through)
    : calculateDailyStreak(habit, entries, through);
}

/**
 * Ein bewusst übersprungener Tag ist neutral: Er verlängert die Serie nicht und
 * bricht sie nicht. Nur ein geplanter Tag ohne Eintrag beendet sie, siehe
 * [ADR 0012](../../../docs/decisions/0012-skip-keeps-the-streak.md).
 */
function calculateDailyStreak(
  habit: Habit,
  entries: readonly HabitEntry[],
  through: CalendarDay,
): HabitStreak {
  const dueDays = getHabitEligibleDays(habit, habit.startDate, through);
  const entriesByDay = getEntriesByDay(
    getVisibleEntries(habit, entries, habit.startDate, through),
  );
  let best = 0;
  let run = 0;
  for (const day of dueDays) {
    const status = entriesByDay.get(day)?.status;
    if (status === "done") {
      run += 1;
      best = Math.max(best, run);
    } else if (status !== "skipped") {
      run = 0;
    }
  }

  let index = dueDays.length - 1;
  if (dueDays[index] === through && entriesByDay.get(through) === undefined) {
    index -= 1;
  }
  let current = 0;
  while (index >= 0) {
    const status = entriesByDay.get(dueDays[index])?.status;
    if (status === "done") current += 1;
    else if (status !== "skipped") break;
    index -= 1;
  }
  return { best, current, unit: "day" };
}

/**
 * Übersprungene Einheiten senken das Wochenziel. Bleibt davon nichts übrig, ist
 * die Woche neutral: Sie zählt weder als Erfolg noch als Bruch, sonst würde
 * eine vollständig übersprungene Woche die Serie verlängern.
 */
function calculateWeeklyStreak(
  habit: Habit,
  entries: readonly HabitEntry[],
  through: CalendarDay,
): HabitStreak {
  const periods = getTimesPerWeekStreakPeriods(habit, through).map((period) => {
    const periodEntries = getVisibleEntries(
      habit,
      entries,
      period.start,
      through < period.end ? through : period.end,
    );
    const done = periodEntries.filter(
      (entry) => entry.status === "done",
    ).length;
    const skipped = periodEntries.filter(
      (entry) => entry.status === "skipped",
    ).length;
    const required = Math.max(0, period.target - skipped);
    return {
      complete: period.end <= through,
      neutral: required === 0,
      success: required > 0 && done >= required,
    };
  });

  let best = 0;
  let run = 0;
  for (const period of periods) {
    if (period.success) {
      run += 1;
      best = Math.max(best, run);
    } else if (period.complete && !period.neutral) {
      run = 0;
    }
  }

  let index = periods.length - 1;
  if (index >= 0 && !periods[index].complete && !periods[index].success) {
    index -= 1;
  }
  let current = 0;
  while (index >= 0 && (periods[index].success || periods[index].neutral)) {
    if (periods[index].success) current += 1;
    index -= 1;
  }
  return { best, current, unit: "week" };
}

function getTimesPerWeekStreakPeriods(habit: Habit, through: CalendarDay) {
  if (habit.schedule.kind !== "timesPerWeek") return [];
  const targetPerWeek = habit.schedule.count;
  const [firstWeek] = getIsoWeekBounds(habit.startDate);
  const [lastWeek] = getIsoWeekBounds(through);
  return enumerateCalendarDays(firstWeek, lastWeek)
    .filter((day) => getIsoWeekBounds(day)[0] === day)
    .map((weekStart) => {
      const [, weekEnd] = getIsoWeekBounds(weekStart);
      const start = weekStart > habit.startDate ? weekStart : habit.startDate;
      const end =
        habit.endDate !== undefined && habit.endDate < weekEnd
          ? habit.endDate
          : weekEnd;
      const activeDays = enumerateCalendarDays(start, end).filter((day) =>
        isHabitEligibleOn(habit, day),
      );
      return {
        end,
        start,
        target: Math.min(targetPerWeek, activeDays.length),
      };
    })
    .filter(
      (period) =>
        period.start <= period.end &&
        period.start <= through &&
        period.target > 0,
    );
}

function getTimesPerWeekPeriods(
  habit: Habit,
  from: CalendarDay,
  to: CalendarDay,
) {
  const first = from > habit.startDate ? from : habit.startDate;
  const last =
    habit.endDate !== undefined && habit.endDate < to ? habit.endDate : to;
  if (first > last || habit.schedule.kind !== "timesPerWeek") return [];
  const targetPerWeek = habit.schedule.count;

  const [firstWeek] = getIsoWeekBounds(first);
  const [lastWeek] = getIsoWeekBounds(last);
  return enumerateCalendarDays(firstWeek, lastWeek)
    .filter((day) => getIsoWeekBounds(day)[0] === day)
    .map((weekStart) => {
      const [, weekEnd] = getIsoWeekBounds(weekStart);
      const start = weekStart > first ? weekStart : first;
      const end = weekEnd < last ? weekEnd : last;
      const activeDays = enumerateCalendarDays(start, end).filter((day) =>
        isHabitEligibleOn(habit, day),
      );
      return {
        end,
        start,
        target: Math.min(targetPerWeek, activeDays.length),
      };
    })
    .filter((period) => period.target > 0);
}

function getVisibleEntries(
  habit: Habit,
  entries: readonly HabitEntry[],
  from: CalendarDay,
  to: CalendarDay,
): HabitEntry[] {
  return entries.filter(
    (entry) =>
      entry.habitId === habit.id &&
      entry.archivedAt === undefined &&
      entry.localDate >= from &&
      entry.localDate <= to,
  );
}

function getEntriesByDay(entries: HabitEntry[]): Map<string, HabitEntry> {
  return new Map(entries.map((entry) => [entry.localDate, entry]));
}

function assertRange(from: CalendarDay, to: CalendarDay): void {
  if (from > to) throw new RangeError("from must not be later than to");
}
