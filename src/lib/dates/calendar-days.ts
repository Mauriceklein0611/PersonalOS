import { calendarDaySchema, type CalendarDay } from "./date-values";

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

export function getIsoWeekBounds(
  value: CalendarDay,
): [CalendarDay, CalendarDay] {
  const start = addCalendarDays(value, 1 - getIsoWeekday(value));
  return [start, addCalendarDays(start, 6)];
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
