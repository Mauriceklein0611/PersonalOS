import type { CalendarDay } from "../../../lib/dates/date-values";
import { createMoney, formatMoney } from "../../../lib/money/money";

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

/**
 * Geld an einer Diagrammachse.
 *
 * `formatValue` bekommt von der Bibliothek auch berechnete Teilstriche, nicht
 * nur die erfassten Beträge. Die liegen je nach Wertebereich zwischen zwei
 * Cent oder unter null, und `createMoney` lehnt beides ab — eine Achse mit
 * einem Teilstrich bei 2400,5 riss so die ganze Seite in die Fehlergrenze.
 * Für eine Beschriftung ist ein ganzer Cent die feinste sinnvolle Stufe.
 */
export function formatMoneyScale(
  amountMinor: number,
  currency: string,
): string {
  const rounded = Math.round(amountMinor);
  const absolute = formatMoney(createMoney(Math.abs(rounded), currency));
  return rounded < 0 ? `−${absolute}` : absolute;
}
