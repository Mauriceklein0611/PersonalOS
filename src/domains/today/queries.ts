import {
  calendarDayForInstant,
  differenceInCalendarDays,
} from "../../lib/dates/calendar-days";
import type { CalendarDay } from "../../lib/dates/date-values";
import type { Habit, HabitEntry } from "../habits/model";
import {
  getHabitActivityState,
  getHabitDayState,
  type HabitDayState,
} from "../habits/view-model";
import type { JournalEntry } from "../journal/model";
import type { Task } from "../tasks/model";
import {
  isTaskOverdue,
  queryTasks,
  type TaskQueryContext,
} from "../tasks/queries";

export type TodayGreeting = "day" | "evening" | "morning";

export type TodayContext = {
  hour: number;
  timeZone: string;
  today: CalendarDay;
};

export type TodayHabit = {
  habit: Habit;
  state: HabitDayState;
};

export type TodayLastMood = {
  ageInDays: number;
  localDate: CalendarDay;
  value: number;
};

export type TodayJournalStatus = {
  filledFieldCount: number;
  hasEntryToday: boolean;
  lastMood?: TodayLastMood;
  showEveningHint: boolean;
};

export type TodayOverview = {
  completedTaskCount: number;
  dueHabits: TodayHabit[];
  greeting: TodayGreeting;
  habitDueCount: number;
  habitSettledCount: number;
  journal: TodayJournalStatus;
  mostImportantTask?: Task;
  openTasks: Task[];
  overdueTaskCount: number;
  settledHabits: TodayHabit[];
};

export type TodayInput = {
  entriesByHabit: ReadonlyMap<string, readonly HabitEntry[]>;
  habits: readonly Habit[];
  journalEntries: readonly JournalEntry[];
  tasks: readonly Task[];
};

const eveningHintFromHour = 18;
const morningUntilHour = 11;
const dayUntilHour = 18;

export function createTodayContext(
  now = new Date(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): TodayContext {
  return {
    hour: getLocalHour(now, timeZone),
    timeZone,
    today: calendarDayForInstant(now, timeZone),
  };
}

/**
 * Die Relevanzregeln des Dashboards liegen bewusst hier und nicht in den
 * Komponenten. Die Funktion liest ausschließlich und verändert keine Quelle.
 */
export function buildTodayOverview(
  input: TodayInput,
  context: TodayContext,
): TodayOverview {
  const taskContext: TaskQueryContext = {
    timeZone: context.timeZone,
    today: context.today,
  };
  const openTasks = queryTasks(input.tasks, "today", taskContext);
  const overdueTaskCount = openTasks.filter((task) =>
    isTaskOverdue(task, taskContext),
  ).length;

  const activeHabits = input.habits.filter(
    (habit) => getHabitActivityState(habit, context.today) === "active",
  );
  const habitStates = activeHabits.map((habit) => ({
    habit,
    state: getHabitDayState(
      habit,
      input.entriesByHabit.get(habit.id) ?? [],
      context.today,
    ),
  }));
  const dueHabits = habitStates.filter((entry) => entry.state === "open");
  const settledHabits = habitStates.filter(
    (entry) => entry.state === "done" || entry.state === "skipped",
  );

  return {
    completedTaskCount: countTasksCompletedOn(input.tasks, context),
    dueHabits,
    greeting: getGreeting(context.hour),
    habitDueCount: dueHabits.length + settledHabits.length,
    habitSettledCount: settledHabits.length,
    journal: buildJournalStatus(input.journalEntries, context),
    mostImportantTask: openTasks[0],
    openTasks,
    overdueTaskCount,
    settledHabits,
  };
}

export function getGreeting(hour: number): TodayGreeting {
  if (hour < morningUntilHour) return "morning";
  if (hour < dayUntilHour) return "day";
  return "evening";
}

function buildJournalStatus(
  entries: readonly JournalEntry[],
  context: TodayContext,
): TodayJournalStatus {
  const visible = entries.filter((entry) => entry.archivedAt === undefined);
  const todayEntry = visible.find((entry) => entry.localDate === context.today);
  const moodEntry = [...visible]
    .filter(
      (entry) => entry.mood !== undefined && entry.localDate <= context.today,
    )
    .sort((left, right) => right.localDate.localeCompare(left.localDate))[0];

  return {
    filledFieldCount: todayEntry ? countFilledFields(todayEntry) : 0,
    hasEntryToday: todayEntry !== undefined,
    lastMood:
      moodEntry?.mood === undefined
        ? undefined
        : {
            ageInDays: differenceInCalendarDays(
              moodEntry.localDate,
              context.today,
            ),
            localDate: moodEntry.localDate,
            value: moodEntry.mood,
          },
    showEveningHint:
      context.hour >= eveningHintFromHour && todayEntry === undefined,
  };
}

function countFilledFields(entry: JournalEntry): number {
  return (
    [
      entry.mood,
      entry.energy,
      entry.stress,
      entry.productivity,
      entry.highlight,
      entry.improvement,
      entry.gratitude,
      entry.body,
    ] as const
  ).filter((value) => value !== undefined).length;
}

function countTasksCompletedOn(
  tasks: readonly Task[],
  context: TodayContext,
): number {
  return tasks.filter(
    (task) =>
      task.archivedAt === undefined &&
      task.status === "completed" &&
      task.completedAt !== undefined &&
      calendarDayForInstant(new Date(task.completedAt), context.timeZone) ===
        context.today,
  ).length;
}

function getLocalHour(now: Date, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone,
    }).format(now),
  );
}
