import type { CalendarDay } from "../../../lib/dates/date-values";

/*
 * Kalendertage tragen keine Uhrzeit. Sie werden deshalb ausdrücklich in UTC
 * formatiert; jede andere Zone könnte den Tag um eins verschieben.
 */

export function formatMonth(month: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${month}-01T00:00:00.000Z`));
}

export function formatDay(day: CalendarDay): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00.000Z`));
}
