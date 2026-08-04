import {
  calendarDaySchema,
  type CalendarDay,
} from "../../lib/dates/date-values";
import type { Task } from "./model";

export type TaskView = "inbox" | "today" | "week" | "completed";

export type TaskQueryContext = {
  timeZone: string;
  today: CalendarDay;
};

const priorityRank: Record<Task["priority"], number> = {
  high: 0,
  normal: 1,
  low: 2,
};

export function createTaskQueryContext(
  now = new Date(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): TaskQueryContext {
  return { timeZone, today: formatCalendarDay(now, timeZone) };
}

export function queryTasks(
  tasks: readonly Task[],
  view: TaskView,
  context: TaskQueryContext,
): Task[] {
  const visible = tasks.filter((task) => task.archivedAt === undefined);

  if (view === "completed") {
    return visible
      .filter((task) => task.status !== "open")
      .sort(
        (left, right) =>
          (right.completedAt ?? right.updatedAt).localeCompare(
            left.completedAt ?? left.updatedAt,
          ) || left.id.localeCompare(right.id),
      );
  }

  const open = visible.filter((task) => task.status === "open");
  const [weekStart, weekEnd] = getWeekBounds(context.today);
  const matching = open.filter((task) => {
    const dates = getTaskCalendarDays(task, context.timeZone);
    if (view === "inbox") return dates.length === 0;
    if (view === "today") return dates.some((date) => date <= context.today);
    return dates.some((date) => date >= weekStart && date <= weekEnd);
  });

  return matching.sort((left, right) =>
    comparePlanningTasks(left, right, context),
  );
}

export function isTaskOverdue(task: Task, context: TaskQueryContext): boolean {
  return (
    task.status === "open" &&
    getTaskCalendarDays(task, context.timeZone).some(
      (date) => date < context.today,
    )
  );
}

export function formatCalendarDay(date: Date, timeZone: string): CalendarDay {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return calendarDaySchema.parse(`${value.year}-${value.month}-${value.day}`);
}

export function getTaskCalendarDays(
  task: Task,
  timeZone: string,
): CalendarDay[] {
  const dates = [
    task.plannedDate,
    task.dueAt ? formatCalendarDay(new Date(task.dueAt), timeZone) : undefined,
  ].filter((value): value is CalendarDay => value !== undefined);
  return [...new Set(dates)].sort();
}

function comparePlanningTasks(
  left: Task,
  right: Task,
  context: TaskQueryContext,
) {
  const overdueDifference =
    Number(isTaskOverdue(right, context)) -
    Number(isTaskOverdue(left, context));
  if (overdueDifference !== 0) return overdueDifference;

  const priorityDifference =
    priorityRank[left.priority] - priorityRank[right.priority];
  if (priorityDifference !== 0) return priorityDifference;

  const leftDate =
    getTaskCalendarDays(left, context.timeZone)[0] ?? "9999-12-31";
  const rightDate =
    getTaskCalendarDays(right, context.timeZone)[0] ?? "9999-12-31";
  return (
    leftDate.localeCompare(rightDate) ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id)
  );
}

function getWeekBounds(today: CalendarDay): [CalendarDay, CalendarDay] {
  const date = parseCalendarDayAsUtc(today);
  const offsetFromMonday = (date.getUTCDay() + 6) % 7;
  const weekStart = addCalendarDays(today, -offsetFromMonday);
  return [weekStart, addCalendarDays(weekStart, 6)];
}

function addCalendarDays(value: CalendarDay, days: number): CalendarDay {
  const date = parseCalendarDayAsUtc(value);
  date.setUTCDate(date.getUTCDate() + days);
  return calendarDaySchema.parse(date.toISOString().slice(0, 10));
}

function parseCalendarDayAsUtc(value: CalendarDay): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
