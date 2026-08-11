import {
  calendarDaySchema,
  calendarMonthSchema,
  type CalendarDay,
  type CalendarMonth,
} from "./date-values";

/** Erster Wochentag: Montag (ISO) oder Sonntag. */
export type WeekStartsOn = 1 | 7;

/**
 * Ein `Intl.DateTimeFormat` ist teuer im Bau und je Zeitzone unveränderlich.
 * Ohne diesen Zwischenspeicher dominiert die Erzeugung jede Auswertung, die
 * viele Datensätze auf lokale Tage abbildet.
 */
const dayFormatters = new Map<string, Intl.DateTimeFormat>();

function getDayFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = dayFormatters.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  });
  dayFormatters.set(timeZone, formatter);
  return formatter;
}

export function calendarDayForInstant(
  instant: Date,
  timeZone: string,
): CalendarDay {
  const parts = getDayFormatter(timeZone).formatToParts(instant);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return calendarDaySchema.parse(`${value.year}-${value.month}-${value.day}`);
}

export function addCalendarDays(value: CalendarDay, days: number): CalendarDay {
  const date = parseCalendarDayAsUtc(value);
  date.setUTCDate(date.getUTCDate() + days);
  return calendarDaySchema.parse(date.toISOString().slice(0, 10));
}

export function getIsoWeekday(value: CalendarDay): number {
  const day = parseCalendarDayAsUtc(value).getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * Der erste Tag der Woche, in der `value` liegt. Bei Sonntagsstart liegt der
 * Montag hinter dem Wochenanfang, deshalb rechnet der Rest gegen sieben.
 */
export function getWeekStart(
  value: CalendarDay,
  weekStartsOn: WeekStartsOn = 1,
): CalendarDay {
  const weekday = getIsoWeekday(value);
  return addCalendarDays(
    value,
    -(weekStartsOn === 1 ? weekday - 1 : weekday % 7),
  );
}

export function getIsoWeekBounds(
  value: CalendarDay,
): [CalendarDay, CalendarDay] {
  const start = getWeekStart(value, 1);
  return [start, addCalendarDays(start, 6)];
}

export function getCalendarMonth(value: CalendarDay): CalendarMonth {
  return calendarMonthSchema.parse(value.slice(0, 7));
}

export function addCalendarMonths(
  value: CalendarMonth,
  months: number,
): CalendarMonth {
  const [year, month] = splitCalendarMonth(value);
  const index = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(index / 12);
  const nextMonth = index - nextYear * 12 + 1;
  return calendarMonthSchema.parse(
    `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}`,
  );
}

/**
 * Erster und letzter Kalendertag des Monats. Das Ende entsteht aus dem Tag vor
 * dem Folgemonat und stimmt damit für 28, 29, 30 und 31 Tage ohne eigene
 * Schaltjahrregel.
 */
export function getCalendarMonthBounds(
  value: CalendarMonth,
): [CalendarDay, CalendarDay] {
  const start = calendarDaySchema.parse(`${value}-01`);
  const nextStart = calendarDaySchema.parse(
    `${addCalendarMonths(value, 1)}-01`,
  );
  return [start, addCalendarDays(nextStart, -1)];
}

export function differenceInCalendarDays(
  from: CalendarDay,
  to: CalendarDay,
): number {
  const milliseconds =
    parseCalendarDayAsUtc(to).getTime() - parseCalendarDayAsUtc(from).getTime();
  return Math.round(milliseconds / 86_400_000);
}

export function enumerateCalendarDays(
  from: CalendarDay,
  to: CalendarDay,
): CalendarDay[] {
  if (from > to) return [];
  const days: CalendarDay[] = [];
  for (let day = from; day <= to; day = addCalendarDays(day, 1)) {
    days.push(day);
  }
  return days;
}

function parseCalendarDayAsUtc(value: CalendarDay): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function splitCalendarMonth(value: CalendarMonth): [number, number] {
  return [Number(value.slice(0, 4)), Number(value.slice(5, 7))];
}
