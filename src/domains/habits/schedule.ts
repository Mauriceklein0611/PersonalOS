import {
  enumerateCalendarDays,
  getIsoWeekBounds,
  getIsoWeekday,
} from "../../lib/dates/calendar-days";
import type { CalendarDay } from "../../lib/dates/date-values";
import type { Habit, HabitEntry } from "./model";

export function isHabitActiveOn(habit: Habit, localDate: CalendarDay): boolean {
  return (
    localDate >= habit.startDate &&
    (habit.endDate === undefined || localDate <= habit.endDate)
  );
}

export function isHabitEligibleOn(
  habit: Habit,
  localDate: CalendarDay,
): boolean {
  if (!isHabitActiveOn(habit, localDate)) return false;
  if (habit.schedule.kind !== "weekdays") return true;
  return habit.schedule.days.includes(getIsoWeekday(localDate));
}

export function isHabitDueOn(
  habit: Habit,
  localDate: CalendarDay,
  entries: readonly HabitEntry[] = [],
): boolean {
  if (!isHabitEligibleOn(habit, localDate)) return false;
  if (habit.schedule.kind !== "timesPerWeek") return true;

  const [weekStart] = getIsoWeekBounds(localDate);
  const completedBeforeDate = new Set(
    entries
      .filter(
        (entry) =>
          entry.habitId === habit.id &&
          entry.archivedAt === undefined &&
          entry.status === "done" &&
          entry.localDate >= weekStart &&
          entry.localDate < localDate,
      )
      .map((entry) => entry.localDate),
  ).size;
  return completedBeforeDate < habit.schedule.count;
}

export function getHabitEligibleDays(
  habit: Habit,
  from: CalendarDay,
  to: CalendarDay,
): CalendarDay[] {
  const first = from > habit.startDate ? from : habit.startDate;
  const last =
    habit.endDate !== undefined && habit.endDate < to ? habit.endDate : to;
  return enumerateCalendarDays(first, last).filter((day) =>
    isHabitEligibleOn(habit, day),
  );
}
