import { calendarDayForInstant } from "../../lib/dates/calendar-days";
import type { CalendarDay } from "../../lib/dates/date-values";
import type { Task } from "./model";
import type { TaskQueryContext } from "./queries";

/**
 * `plannedDate` beantwortet „wann nehme ich mir das vor", `dueAt` „bis wann
 * muss es stehen". Beides zu einem „überfällig" zu verschmelzen, verwischt
 * genau den Unterschied: Ein verstrichenes Plandatum ist eine Verabredung mit
 * sich selbst, eine verstrichene Frist kommt von außen.
 */
export type TaskTimingState =
  | "bothElapsed"
  | "deadlineElapsed"
  | "deadlineOnly"
  | "planElapsed"
  | "planned"
  | "unscheduled";

export type TaskTiming = {
  /**
   * Nur ein Hinweis auf einen verstrichenen Zeitpunkt, keine Bewertung — die
   * Oberfläche hebt ihn hervor, wertet ihn aber nicht.
   */
  isElapsed: boolean;
  label: string;
  state: TaskTimingState;
};

const timingLabels: Record<TaskTimingState, string> = {
  bothElapsed: "Plandatum und Frist verstrichen",
  deadlineElapsed: "Frist verstrichen",
  deadlineOnly: "Frist ohne Plandatum",
  planElapsed: "Plandatum verstrichen",
  planned: "Geplant",
  unscheduled: "Ohne Termin",
};

/** Der Kalendertag, auf den die Frist in der Zeitzone des Nutzers fällt. */
export function getTaskDeadlineDay(
  task: Task,
  timeZone: string,
): CalendarDay | undefined {
  return task.dueAt === undefined
    ? undefined
    : calendarDayForInstant(new Date(task.dueAt), timeZone);
}

/**
 * Die eine Stelle, die den zeitlichen Zustand einer Aufgabe benennt. Sowohl
 * die Aufgabenkarte als auch die Dashboard-Liste lesen daraus; vorher hatte
 * jede ihre eigene, unterschiedlich strenge Auslegung.
 */
export function describeTaskTiming(
  task: Task,
  context: TaskQueryContext,
): TaskTiming {
  const deadlineDay = getTaskDeadlineDay(task, context.timeZone);

  // Ein abgeschlossener oder abgebrochener Zeitpunkt verstreicht nicht mehr:
  // Was erledigt ist, wird nicht rückwirkend zur Mahnung.
  const isOpen = task.status === "open";
  const planElapsed =
    isOpen && task.plannedDate !== undefined && task.plannedDate < context.today;
  const deadlineElapsed =
    isOpen && deadlineDay !== undefined && deadlineDay < context.today;

  const state = resolveState({
    deadlineDay,
    deadlineElapsed,
    plannedDate: task.plannedDate,
    planElapsed,
    today: context.today,
  });

  return {
    isElapsed: planElapsed || deadlineElapsed,
    label:
      state === "planned" && task.plannedDate === context.today
        ? "Für heute geplant"
        : timingLabels[state],
    state,
  };
}

function resolveState({
  deadlineDay,
  deadlineElapsed,
  plannedDate,
  planElapsed,
}: {
  deadlineDay: CalendarDay | undefined;
  deadlineElapsed: boolean;
  plannedDate: CalendarDay | undefined;
  planElapsed: boolean;
  today: CalendarDay;
}): TaskTimingState {
  if (planElapsed && deadlineElapsed) return "bothElapsed";
  if (planElapsed) return "planElapsed";
  if (deadlineElapsed) return "deadlineElapsed";
  // Eine Aufgabe, die nur eine Frist trägt, ist noch für keinen Tag
  // eingeplant. Das ist ein eigener Zustand, kein Sonderfall von „geplant".
  if (plannedDate === undefined && deadlineDay !== undefined) {
    return "deadlineOnly";
  }
  if (plannedDate !== undefined) return "planned";
  return "unscheduled";
}
