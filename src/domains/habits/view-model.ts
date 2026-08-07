import { addCalendarDays } from "../../lib/dates/calendar-days";
import type { CalendarDay } from "../../lib/dates/date-values";
import type { HabitStreak } from "./metrics";
import type { Habit, HabitEntry, HabitSchedule } from "./model";
import { isHabitDueOn, isHabitEligibleOn } from "./schedule";

export type HabitActivityState = "active" | "archived" | "paused" | "upcoming";
export type HabitDayState = "done" | "not-due" | "open" | "skipped";
export type HabitProgressPeriod = "last28Days" | "last7Days" | "sinceStart";
export type HabitProgressRange = { from: CalendarDay; to: CalendarDay };

const progressPeriodDays: Record<HabitProgressPeriod, number | undefined> = {
  last7Days: 7,
  last28Days: 28,
  sinceStart: undefined,
};

const weekdayLabels = new Map([
  [1, "Mo"],
  [2, "Di"],
  [3, "Mi"],
  [4, "Do"],
  [5, "Fr"],
  [6, "Sa"],
  [7, "So"],
]);

export function getHabitActivityState(
  habit: Habit,
  today: CalendarDay,
): HabitActivityState {
  if (habit.archivedAt !== undefined) return "archived";
  if (habit.startDate > today) return "upcoming";
  if (habit.endDate !== undefined && habit.endDate < today) return "paused";
  return "active";
}

export function getHabitDayState(
  habit: Habit,
  entries: readonly HabitEntry[],
  localDate: CalendarDay,
): HabitDayState {
  const entry = entries.find(
    (candidate) =>
      candidate.archivedAt === undefined && candidate.localDate === localDate,
  );
  if (entry?.status === "done") return "done";
  if (entry?.status === "skipped") return "skipped";
  if (
    !isHabitEligibleOn(habit, localDate) ||
    !isHabitDueOn(habit, localDate, entries)
  ) {
    return "not-due";
  }
  return "open";
}

export function getHabitScheduleLabel(schedule: HabitSchedule): string {
  if (schedule.kind === "daily") return "Täglich";
  if (schedule.kind === "timesPerWeek") {
    return `${schedule.count}× pro Woche`;
  }
  return schedule.days
    .map((day) => weekdayLabels.get(day))
    .filter((label): label is string => label !== undefined)
    .join(", ");
}

export const habitDayStateLabels: Record<HabitDayState, string> = {
  done: "Erledigt",
  "not-due": "Nicht fällig",
  open: "Offen",
  skipped: "Übersprungen",
};

export const habitDayActionLabels: Record<HabitDayState, string> = {
  done: "Check-in entfernen",
  "not-due": "Zusätzlich erledigen",
  open: "Als erledigt eintragen",
  skipped: "Als erledigt eintragen",
};

export const habitActivityStateLabels: Record<HabitActivityState, string> = {
  active: "Aktiv",
  archived: "Archiviert",
  paused: "Pausiert",
  upcoming: "Startet später",
};

export const habitProgressPeriodLabels: Record<HabitProgressPeriod, string> = {
  last7Days: "Letzte 7 Tage",
  last28Days: "Letzte 28 Tage",
  sinceStart: "Seit dem Start",
};

/**
 * Der Zeitraum beginnt nie vor dem Startdatum, damit die Quote keine Tage
 * bewertet, an denen es die Gewohnheit noch nicht gab.
 */
export function getHabitProgressRange(
  habit: Habit,
  period: HabitProgressPeriod,
  today: CalendarDay,
): HabitProgressRange | undefined {
  if (habit.startDate > today) return undefined;
  const days = progressPeriodDays[period];
  const earliest =
    days === undefined ? habit.startDate : addCalendarDays(today, 1 - days);
  return {
    from: earliest > habit.startDate ? earliest : habit.startDate,
    to: today,
  };
}

export function getHabitTargetUnitLabel(schedule: HabitSchedule): string {
  return schedule.kind === "timesPerWeek"
    ? "geplanten Wocheneinheiten"
    : "geplanten Tagen";
}

/** Dieselbe Einheit ohne „geplant“, für Sätze über die zählenden Einheiten. */
export function getHabitUnitLabel(schedule: HabitSchedule): string {
  return schedule.kind === "timesPerWeek" ? "Wocheneinheiten" : "Tagen";
}

export function formatHabitStreak(streak: HabitStreak["unit"], value: number) {
  if (streak === "week") return value === 1 ? "1 Woche" : `${value} Wochen`;
  return value === 1 ? "1 Tag" : `${value} Tage`;
}

export function formatHabitRate(rate: number | null): string {
  return rate === null ? "Keine Angabe" : `${Math.round(rate * 100)} %`;
}

export function formatCalendarDay(day: CalendarDay): string {
  return formatWithOptions(day, { dateStyle: "medium" });
}

export function formatCalendarDayLong(day: CalendarDay): string {
  return formatWithOptions(day, { dateStyle: "long" });
}

export function formatCalendarDayShort(day: CalendarDay): string {
  return formatWithOptions(day, { day: "2-digit", month: "2-digit" });
}

export function formatCalendarWeekday(day: CalendarDay): string {
  return formatWithOptions(day, { weekday: "short" });
}

function formatWithOptions(
  day: CalendarDay,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("de-DE", {
    ...options,
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00.000Z`));
}
