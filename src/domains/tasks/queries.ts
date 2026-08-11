import { type CalendarDay } from "../../lib/dates/date-values";
import {
  calendarDayForInstant,
  getIsoWeekBounds,
} from "../../lib/dates/calendar-days";

export { calendarDayForInstant as formatCalendarDay };
import type { Task } from "./model";

export type TaskView = "inbox" | "today" | "week" | "completed";

export type TaskQueryContext = {
  timeZone: string;
  today: CalendarDay;
};

/** Reihenfolge der Priorität in jeder Planungsansicht. */
export const taskPriorityRank: Record<Task["priority"], number> = {
  high: 0,
  normal: 1,
  low: 2,
};

export function createTaskQueryContext(
  now = new Date(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): TaskQueryContext {
  return { timeZone, today: calendarDayForInstant(now, timeZone) };
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
  const [weekStart, weekEnd] = getIsoWeekBounds(context.today);
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

export function getTaskCalendarDays(
  task: Task,
  timeZone: string,
): CalendarDay[] {
  const dates = [
    task.plannedDate,
    task.dueAt
      ? calendarDayForInstant(new Date(task.dueAt), timeZone)
      : undefined,
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
    taskPriorityRank[left.priority] - taskPriorityRank[right.priority];
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
