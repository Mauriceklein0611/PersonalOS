import type { CalendarDay } from "../../lib/dates/date-values";
import { monthOfDay } from "./budget";
import type { SavingsContribution, Transaction } from "./model";

/**
 * Ein verknüpfter Sparbeitrag ist dieselbe Bewegung wie seine Ausgabe, nur aus
 * Sicht des Sparziels. Damit das nachweisbar bleibt und derselbe Betrag nie
 * doppelt zählt, muss die Ausgabe in allen fünf Punkten passen. Eine
 * teilweise Verknüpfung gibt es bewusst nicht: Sie wäre ohne Konten nicht
 * eindeutig auflösbar.
 */
export class SavingsLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SavingsLinkError";
  }
}

/** Der Beitrag, so wie er gespeichert werden soll. */
export type SavingsLinkSubject = {
  amountMinor: number;
  bookedOn: CalendarDay;
  currency: string;
};

export type SavingsLinkRejection =
  | "already-linked"
  | "different-amount"
  | "different-currency"
  | "different-month"
  | "not-an-expense"
  | "unknown-transaction";

export type SavingsLinkCheck =
  { ok: true } | { ok: false; reason: SavingsLinkRejection };

const rejectionMessages: Record<SavingsLinkRejection, string> = {
  "already-linked":
    "Diese Ausgabe ist bereits mit einem Sparbeitrag verknüpft. Eine Ausgabe kann höchstens einen Beitrag belegen.",
  "different-amount":
    "Betrag und Ausgabe stimmen nicht überein. Verknüpft wird nur ein Beitrag über denselben Betrag.",
  "different-currency":
    "Ausgabe und Beitrag verwenden verschiedene Währungen. Umgerechnet wird nicht.",
  "different-month":
    "Die Ausgabe gehört zu einem anderen Monat als der Beitrag.",
  "not-an-expense":
    "Nur eine Ausgabe kann einen Sparbeitrag belegen; eine Einnahme nicht.",
  "unknown-transaction": "Die gewählte Buchung ist nicht mehr vorhanden.",
};

export function describeSavingsLinkRejection(
  reason: SavingsLinkRejection,
): string {
  return rejectionMessages[reason];
}

/**
 * Prüft eine gewünschte Verknüpfung. `contributions` enthält auch archivierte
 * Beiträge: Ein zurückgenommener Beitrag behält seinen Verweis und belegt die
 * Ausgabe weiterhin.
 */
export function checkSavingsLink(
  transaction: Transaction | undefined,
  subject: SavingsLinkSubject,
  contributions: readonly SavingsContribution[],
  editedContributionId?: string,
): SavingsLinkCheck {
  if (transaction === undefined || transaction.archivedAt !== undefined) {
    return { ok: false, reason: "unknown-transaction" };
  }
  if (transaction.kind !== "expense") {
    return { ok: false, reason: "not-an-expense" };
  }
  if (transaction.money.currency !== subject.currency) {
    return { ok: false, reason: "different-currency" };
  }
  if (transaction.money.amountMinor !== subject.amountMinor) {
    return { ok: false, reason: "different-amount" };
  }
  if (monthOfDay(transaction.bookedOn) !== monthOfDay(subject.bookedOn)) {
    return { ok: false, reason: "different-month" };
  }
  if (
    contributions.some(
      (contribution) =>
        contribution.sourceTransactionId === transaction.id &&
        contribution.id !== editedContributionId,
    )
  ) {
    return { ok: false, reason: "already-linked" };
  }

  return { ok: true };
}

/** Die Ausgaben, die zu diesem Beitrag passen; sonst eine leere Liste. */
export function findLinkableTransactions(
  transactions: readonly Transaction[],
  subject: SavingsLinkSubject,
  contributions: readonly SavingsContribution[],
  editedContributionId?: string,
): Transaction[] {
  return transactions.filter(
    (transaction) =>
      checkSavingsLink(
        transaction,
        subject,
        contributions,
        editedContributionId,
      ).ok,
  );
}
