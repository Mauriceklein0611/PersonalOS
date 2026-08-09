import type { CalendarDay } from "../../lib/dates/date-values";
import type { RecurringTransaction, Transaction } from "./model";

/**
 * Eine fällige Vorlage ist ein **Vorschlag**, kein geplanter Vorgang. Nichts
 * an dieser Auswertung schreibt; erst die Bestätigung des Nutzers erzeugt eine
 * Buchung. Siehe
 * [ADR 0013](../../../docs/decisions/0013-recurring-transactions-are-confirmed-templates.md).
 */
export type DueRecurringTransaction = {
  /** Der Tag, für den die Buchung vorgeschlagen wird. */
  proposedDate: CalendarDay;
  template: RecurringTransaction;
};

/** Der Kalendermonat eines Tages, also `YYYY-MM`. */
export function monthOfCalendarDay(day: CalendarDay): string {
  return day.slice(0, 7);
}

/**
 * Der vorgeschlagene Buchungstag im Monat des Stichtags. `dayOfMonth` ist auf
 * 28 begrenzt, deshalb gibt es ihn in jedem Monat und die Zusammensetzung
 * bleibt eine reine Zeichenkette ohne Zeitzonenfrage.
 */
export function getProposedDate(
  template: RecurringTransaction,
  today: CalendarDay,
): CalendarDay {
  const day = String(template.dayOfMonth).padStart(2, "0");
  return `${monthOfCalendarDay(today)}-${day}`;
}

/**
 * Ob eine Vorlage im Monat des Stichtags bereits bestätigt wurde. Die Antwort
 * wird aus den Buchungen abgeleitet, nicht in der Vorlage vermerkt: Ein
 * zweites Feld wäre ein zweiter Wahrheitsträger, der beim Rücknehmen einer
 * Buchung stillschweigend falsch stünde.
 *
 * Eine archivierte Buchung zählt deshalb nicht: Ihre Rücknahme war die Aussage
 * des Nutzers, dass diese Buchung so nicht stattgefunden hat.
 */
export function isConfirmedInMonth(
  template: RecurringTransaction,
  transactions: readonly Transaction[],
  today: CalendarDay,
): boolean {
  const month = monthOfCalendarDay(today);
  return transactions.some(
    (transaction) =>
      transaction.archivedAt === undefined &&
      transaction.recurringTransactionId === template.id &&
      monthOfCalendarDay(transaction.bookedOn) === month,
  );
}

/**
 * Die im laufenden Monat offenen Vorlagen, aufsteigend nach Monatstag.
 *
 * Fällig ist eine Vorlage, sobald ihr Monatstag erreicht ist; sie bleibt bis
 * zum Monatsende stehen. Ein verpasster Tag lässt den Vorschlag also nicht
 * verschwinden — sonst wäre die Erinnerung genau dann weg, wenn sie gebraucht
 * wird.
 */
export function listDueRecurringTransactions(
  templates: readonly RecurringTransaction[],
  transactions: readonly Transaction[],
  today: CalendarDay,
): DueRecurringTransaction[] {
  const dayOfMonth = Number(today.slice(8, 10));

  return templates
    .filter(
      (template) =>
        template.archivedAt === undefined &&
        template.dayOfMonth <= dayOfMonth &&
        !isConfirmedInMonth(template, transactions, today),
    )
    .sort(
      (left, right) =>
        left.dayOfMonth - right.dayOfMonth ||
        left.name.localeCompare(right.name),
    )
    .map((template) => ({
      proposedDate: getProposedDate(template, today),
      template,
    }));
}

/**
 * Die Buchung, die aus einer Bestätigung entsteht. Sie trägt die Kennung der
 * Vorlage und bleibt dadurch als aus ihr entstanden erkennbar.
 */
export function buildTransactionFromTemplate(
  due: DueRecurringTransaction,
): Omit<Transaction, "id" | "createdAt" | "updatedAt"> {
  const { proposedDate, template } = due;
  return {
    bookedOn: proposedDate,
    categoryId: template.categoryId,
    description: template.description,
    kind: template.kind,
    money: template.money,
    recurringTransactionId: template.id,
  };
}
