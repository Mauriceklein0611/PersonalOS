import {
  enumerateCalendarDays,
  getCalendarMonthBounds,
  getWeekStart,
  type WeekStartsOn,
} from "../../lib/dates/calendar-days";
import type { CalendarDay, CalendarMonth } from "../../lib/dates/date-values";
import { calculateHabitFulfillment, type HabitFulfillment } from "./metrics";
import type { Habit, HabitEntry } from "./model";
import { isHabitActiveOn, isHabitEligibleOn } from "./schedule";
import { getHabitDayState } from "./view-model";

/**
 * Ein Tag im Monatsraster. `open` meint einen vergangenen fälligen Tag ohne
 * Eintrag, `future` einen fälligen Tag, der noch bevorsteht. Beide sind
 * ausdrücklich verschieden: Nur der vergangene Tag zählt in eine Quote.
 */
export type HabitMonthCellState =
  "done" | "future" | "not-due" | "open" | "outside" | "skipped";

export type HabitMonthCell = {
  day: CalendarDay;
  /** Wahr, wo auch die Wochenansicht eine Änderung erlaubt. */
  interactive: boolean;
  state: HabitMonthCellState;
};

export type HabitMonthRow = {
  cells: HabitMonthCell[];
  /**
   * Die Quote des Monats bis einschließlich heute. `undefined`, solange der
   * Monat für diese Routine noch keinen vergangenen Tag hat — dann gibt es
   * keine Grundlage und damit keine Zahl.
   */
  fulfillment?: HabitFulfillment;
  habit: Habit;
};

export type HabitMonthDay = {
  /** Zählende fällige Einheiten des Tages: `max(done, due - skipped)`. */
  counted: number;
  day: CalendarDay;
  done: number;
  /** Alle an diesem Tag fälligen Einheiten, einschließlich übersprungener. */
  due: number;
  isFuture: boolean;
  isToday: boolean;
  /** Erster Tag seiner Woche und damit die strukturelle Wochengrenze. */
  isWeekStart: boolean;
  rate: number | null;
  skipped: number;
};

export type HabitMonthWeek = {
  days: CalendarDay[];
  start: CalendarDay;
};

export type HabitMonthSummary = {
  counted: number;
  done: number;
  rate: number | null;
  skipped: number;
};

export type HabitMonthView = {
  /**
   * Letzter Tag, der in die Quoten eingeht: der frühere von Monatsende und
   * heute. `undefined`, wenn der ganze Monat noch bevorsteht.
   */
  countedTo?: CalendarDay;
  days: HabitMonthDay[];
  from: CalendarDay;
  month: CalendarMonth;
  rows: HabitMonthRow[];
  summary: HabitMonthSummary;
  to: CalendarDay;
  weeks: HabitMonthWeek[];
};

export type HabitMonthViewInput = {
  entriesByHabit: ReadonlyMap<string, readonly HabitEntry[]>;
  habits: readonly Habit[];
  month: CalendarMonth;
  today: CalendarDay;
  weekStartsOn?: WeekStartsOn;
};

export const habitMonthStateLabels: Record<HabitMonthCellState, string> = {
  done: "Erledigt",
  future: "Später fällig",
  "not-due": "Nicht fällig",
  open: "Offen",
  outside: "Außerhalb des Zeitraums",
  skipped: "Übersprungen",
};

/**
 * Nur für Zustände, die bedienbar sein können. Ein zukünftiger und ein
 * außerhalb liegender Tag haben keine Wirkung und deshalb kein Wirkungslabel.
 */
export const habitMonthActionLabels: Partial<
  Record<HabitMonthCellState, string>
> = {
  done: "Check-in entfernen",
  "not-due": "Zusätzlich erledigen",
  open: "Als erledigt eintragen",
  skipped: "Als erledigt eintragen",
};

/**
 * Baut das Monatsraster aus Rhythmus und erfassten Check-ins. Alle Zahlen sind
 * abgeleitet; es entsteht keine zweite persistierte Kennzahl. Der Nenner bleibt
 * `counted` aus `calculateHabitFulfillment`, niemals `Routinen × Kalendertage`.
 */
export function buildHabitMonthView({
  entriesByHabit,
  habits,
  month,
  today,
  weekStartsOn = 1,
}: HabitMonthViewInput): HabitMonthView {
  const [from, to] = getCalendarMonthBounds(month);
  const days = enumerateCalendarDays(from, to);
  const countedTo = from > today ? undefined : to < today ? to : today;

  /*
   * `getHabitDayState` zählt bei `timesPerWeek` die erledigten Tage derselben
   * ISO-Woche mit. Der Ausschnitt beginnt deshalb am Montag vor dem Monat,
   * sonst fehlt der ersten Monatswoche ihre Vorgeschichte. Er begrenzt
   * zugleich die Arbeit je Zelle auf die Einträge dieses Zeitraums.
   */
  const scopeFrom = getWeekStart(from, 1);

  const rows = habits
    .filter(
      (habit) =>
        habit.archivedAt === undefined &&
        habit.startDate <= to &&
        (habit.endDate === undefined || habit.endDate >= from),
    )
    .map<HabitMonthRow>((habit) => {
      const entries = (entriesByHabit.get(habit.id) ?? []).filter(
        (entry) =>
          entry.archivedAt === undefined &&
          entry.localDate >= scopeFrom &&
          entry.localDate <= to,
      );
      return {
        cells: days.map((day) => ({
          day,
          interactive: isHabitEligibleOn(habit, day) && day <= today,
          state: getHabitMonthCellState(habit, entries, day, today),
        })),
        fulfillment:
          countedTo !== undefined && habit.startDate <= countedTo
            ? calculateHabitFulfillment(habit, entries, from, countedTo)
            : undefined,
        habit,
      };
    });

  const monthDays = days.map((day, index) =>
    summariseDay(
      day,
      rows.map((row) => row.cells[index].state),
      today,
      getWeekStart(day, weekStartsOn) === day,
    ),
  );

  return {
    countedTo,
    days: monthDays,
    from,
    month,
    rows,
    summary: summariseMonth(monthDays),
    to,
    weeks: groupWeeks(days, weekStartsOn),
  };
}

/**
 * Ein erfasster Check-in bleibt sichtbar, auch wenn der Tag außerhalb des
 * Aktivzeitraums oder des heutigen Rhythmus liegt: Er ist passiert. Erst
 * danach entscheidet der Zeitraum, und zuletzt die Lage zu heute.
 */
function getHabitMonthCellState(
  habit: Habit,
  entries: readonly HabitEntry[],
  day: CalendarDay,
  today: CalendarDay,
): HabitMonthCellState {
  const state = getHabitDayState(habit, entries, day);
  if (state === "done" || state === "skipped") return state;
  if (!isHabitActiveOn(habit, day)) return "outside";
  if (state === "not-due") return "not-due";
  return day > today ? "future" : "open";
}

/**
 * Die Tagesquote zählt nur, was an diesem Tag fällig war. Zukünftige und nicht
 * fällige Zellen bleiben außen vor; ohne Grundlage bleibt die Quote `null`.
 */
function summariseDay(
  day: CalendarDay,
  states: readonly HabitMonthCellState[],
  today: CalendarDay,
  isWeekStart: boolean,
): HabitMonthDay {
  const done = states.filter((state) => state === "done").length;
  const skipped = states.filter((state) => state === "skipped").length;
  const due =
    done + skipped + states.filter((state) => state === "open").length;
  const counted = Math.max(done, due - skipped);
  return {
    counted,
    day,
    done,
    due,
    isFuture: day > today,
    isToday: day === today,
    isWeekStart,
    rate: counted === 0 ? null : done / counted,
    skipped,
  };
}

function summariseMonth(days: readonly HabitMonthDay[]): HabitMonthSummary {
  const counted = sum(days.map((day) => day.counted));
  const done = sum(days.map((day) => day.done));
  return {
    counted,
    done,
    rate: counted === 0 ? null : done / counted,
    skipped: sum(days.map((day) => day.skipped)),
  };
}

function groupWeeks(
  days: readonly CalendarDay[],
  weekStartsOn: WeekStartsOn,
): HabitMonthWeek[] {
  const weeks: HabitMonthWeek[] = [];
  for (const day of days) {
    const start = getWeekStart(day, weekStartsOn);
    const current = weeks.at(-1);
    if (current?.start === start) current.days.push(day);
    else weeks.push({ days: [day], start });
  }
  return weeks;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
