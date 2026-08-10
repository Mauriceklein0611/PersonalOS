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

export type TodayCapacity = {
  /** Fehlt, wenn kein Tagesbudget gesetzt ist — nicht null Minuten. */
  budgetMinutes?: number;
  estimatedTaskCount: number;
  isOverBudget: boolean;
  totalMinutes: number;
  unestimatedTaskCount: number;
};

/**
 * Der Tagesfortschritt über Aufgaben **und** Gewohnheiten.
 *
 * Der Ring ist das prominenteste Element der Seite. Solange er allein die
 * Gewohnheiten maß, zeigte er einen Bruchteil des Tages und blieb an einem
 * Tag ohne fällige Gewohnheit selbst dann leer, wenn alle Aufgaben erledigt
 * waren.
 *
 * `planned` ist null, wenn für heute weder eine Aufgabe noch eine Gewohnheit
 * ansteht. Dann gibt es keinen Anteil — und nicht etwa null Prozent.
 */
export type TodayProgress = {
  done: number;
  planned: number;
  /** Anteil der erledigten an den geplanten Einheiten, oder `null`. */
  ratio: number | null;
};

export type TodayOverview = {
  /** Fehlt, solange keine einzige offene Aufgabe eine Schätzung trägt. */
  capacity?: TodayCapacity;
  completedTaskCount: number;
  dueHabits: TodayHabit[];
  greeting: TodayGreeting;
  habitDueCount: number;
  habitSettledCount: number;
  journal: TodayJournalStatus;
  mostImportantTask?: Task;
  openTasks: Task[];
  overdueTaskCount: number;
  progress: TodayProgress;
  settledHabits: TodayHabit[];
};

export type TodayInput = {
  /** Aus dem Settings-Datensatz; fehlt, solange kein Budget gesetzt ist. */
  dailyCapacityMinutes?: number;
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

  const completedTaskCount = countTasksCompletedOn(input.tasks, context);

  return {
    capacity: buildCapacity(openTasks, input.dailyCapacityMinutes),
    completedTaskCount,
    dueHabits,
    greeting: getGreeting(context.hour),
    habitDueCount: dueHabits.length + settledHabits.length,
    habitSettledCount: settledHabits.length,
    journal: buildJournalStatus(input.journalEntries, context),
    mostImportantTask: openTasks[0],
    openTasks,
    overdueTaskCount,
    progress: buildProgress({
      completedTaskCount,
      habitDueCount: dueHabits.length + settledHabits.length,
      habitSettledCount: settledHabits.length,
      openTaskCount: openTasks.length,
    }),
    settledHabits,
  };
}

/**
 * Erledigte von geplanten Einheiten. Eine Einheit ist eine für heute geplante
 * Aufgabe oder eine heute fällige Gewohnheit; beide zählen gleich, weil beide
 * eine Handlung des Tages sind.
 *
 * Eine heute abgeschlossene Aufgabe steht nicht mehr in `openTasks`. Sie
 * gehört trotzdem in beide Zahlen — sonst schrumpfte der Nenner mit jedem
 * Haken, und der Ring stünde den ganzen Tag bei hundert Prozent.
 */
function buildProgress({
  completedTaskCount,
  habitDueCount,
  habitSettledCount,
  openTaskCount,
}: {
  completedTaskCount: number;
  habitDueCount: number;
  habitSettledCount: number;
  openTaskCount: number;
}): TodayProgress {
  const planned = openTaskCount + completedTaskCount + habitDueCount;
  const done = completedTaskCount + habitSettledCount;

  return {
    done,
    planned,
    ratio: planned === 0 ? null : done / planned,
  };
}

/**
 * Die Summe der Schätzungen des Tages. Sie ist eine Planungshilfe, keine
 * Aussage über Leistungsfähigkeit, und sie erscheint nur, wenn wenigstens
 * eine Aufgabe geschätzt ist: Ohne eine einzige Schätzung wäre jede Zahl
 * eine Behauptung.
 *
 * Aufgaben ohne Schätzung zählen ausdrücklich mit — als eigene Zahl, nicht
 * als null Minuten. Sonst läse sich ein ungeschätzter Tag als leerer Tag.
 */
function buildCapacity(
  openTasks: readonly Task[],
  budgetMinutes: number | undefined,
): TodayCapacity | undefined {
  const estimated = openTasks.filter(
    (task) => task.estimatedMinutes !== undefined,
  );
  if (estimated.length === 0) return undefined;

  const totalMinutes = estimated.reduce(
    (total, task) => total + (task.estimatedMinutes ?? 0),
    0,
  );

  return {
    budgetMinutes,
    estimatedTaskCount: estimated.length,
    isOverBudget: budgetMinutes !== undefined && totalMinutes > budgetMinutes,
    totalMinutes,
    unestimatedTaskCount: openTasks.length - estimated.length,
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
