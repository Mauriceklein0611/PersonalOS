import {
  addCalendarDays,
  enumerateCalendarDays,
  getWeekStart,
  type WeekStartsOn,
} from "../../lib/dates/calendar-days";
import type { CalendarDay } from "../../lib/dates/date-values";
import type { Task } from "./model";
import { taskPriorityRank } from "./queries";

export type TaskWeekDay = {
  completed: number;
  day: CalendarDay;
  isToday: boolean;
  /**
   * Der Nenner des Tages: offene und abgeschlossene Aufgaben mit diesem
   * Plandatum. Ein Abschluss verschiebt eine Aufgabe zwischen den Zählern und
   * lässt den Nenner unberührt.
   */
  planned: number;
  /** `null`, wenn für den Tag nichts geplant ist. Niemals `0 %`. */
  rate: number | null;
  tasks: Task[];
};

export type TaskWeekPlan = {
  completed: number;
  days: TaskWeekDay[];
  from: CalendarDay;
  planned: number;
  rate: number | null;
  to: CalendarDay;
};

export type TaskWeekPlanInput = {
  tasks: readonly Task[];
  today: CalendarDay;
  weekStartsOn?: WeekStartsOn;
};

/**
 * Die Woche aus Sicht der Planung. Grundlage ist ausschließlich
 * `plannedDate`: Eine Frist sagt, bis wann etwas stehen muss, nicht, wann es
 * sich jemand vorgenommen hat. Aufgaben ohne Plandatum bleiben in der Inbox
 * und werden hier keinem Tag zugeordnet.
 */
export function buildTaskWeekPlan({
  tasks,
  today,
  weekStartsOn = 1,
}: TaskWeekPlanInput): TaskWeekPlan {
  const from = getWeekStart(today, weekStartsOn);
  const to = addCalendarDays(from, 6);

  const planned = tasks.filter(
    (task) =>
      task.archivedAt === undefined &&
      task.status !== "cancelled" &&
      task.plannedDate !== undefined &&
      task.plannedDate >= from &&
      task.plannedDate <= to,
  );

  const days = enumerateCalendarDays(from, to).map<TaskWeekDay>((day) => {
    const dayTasks = planned
      .filter((task) => task.plannedDate === day)
      .sort(compareDayTasks);
    const completed = dayTasks.filter(
      (task) => task.status === "completed",
    ).length;
    return {
      completed,
      day,
      isToday: day === today,
      planned: dayTasks.length,
      rate: dayTasks.length === 0 ? null : completed / dayTasks.length,
      tasks: dayTasks,
    };
  });

  const completed = days.reduce((total, day) => total + day.completed, 0);
  return {
    completed,
    days,
    from,
    planned: planned.length,
    rate: planned.length === 0 ? null : completed / planned.length,
    to,
  };
}

/**
 * Offenes zuerst, danach das Erledigte. Innerhalb eines Tages sagt die
 * Reihenfolge nach Datum nichts mehr, deshalb entscheidet die Priorität.
 */
function compareDayTasks(left: Task, right: Task): number {
  return (
    Number(right.status === "open") - Number(left.status === "open") ||
    taskPriorityRank[left.priority] - taskPriorityRank[right.priority] ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id)
  );
}
