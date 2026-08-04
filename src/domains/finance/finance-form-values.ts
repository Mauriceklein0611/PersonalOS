import {
  calendarDaySchema,
  type CalendarDay,
} from "../../lib/dates/date-values";
import { parseMoneyInput, type Money } from "../../lib/money/money";
import type { FinanceKind, TransactionDetails } from "./model";

export type TransactionFormValues = {
  amount: string;
  bookedOn: string;
  categoryId: string;
  description: string;
  kind: FinanceKind;
};

export type TransactionFormErrors = Partial<
  Record<"amount" | "bookedOn" | "categoryId", string>
>;

export type TransactionFormResult =
  | { ok: true; details: TransactionDetails }
  | { ok: false; errors: TransactionFormErrors };

const amountMessages: Record<string, string> = {
  empty: "Gib einen Betrag ein, zum Beispiel 12,50.",
  format: "Gib einen Betrag ohne Vorzeichen ein, zum Beispiel 12,50.",
  precision: "Gib höchstens zwei Nachkommastellen ein, zum Beispiel 12,50.",
};

export function createTransactionFormValues(
  today: CalendarDay,
  kind: FinanceKind = "expense",
): TransactionFormValues {
  return {
    amount: "",
    bookedOn: today,
    categoryId: "",
    description: "",
    kind,
  };
}

/**
 * Prüft die Eingabe vollständig und meldet jedes Problem einzeln, damit das
 * Formular alle Korrekturen auf einmal zeigen kann.
 */
export function toTransactionDetails(
  values: TransactionFormValues,
  currency: string,
): TransactionFormResult {
  const errors: TransactionFormErrors = {};

  const amount = parseMoneyInput(values.amount, currency);
  if (!amount.ok) {
    errors.amount = amountMessages[amount.reason] ?? amountMessages.format;
  }

  const bookedOn = calendarDaySchema.safeParse(values.bookedOn);
  if (!bookedOn.success) {
    errors.bookedOn = "Wähle ein gültiges Datum.";
  }

  if (values.categoryId.trim().length === 0) {
    errors.categoryId = "Wähle eine Kategorie.";
  }

  if (Object.keys(errors).length > 0 || !amount.ok || !bookedOn.success) {
    return { errors, ok: false };
  }

  const description = values.description.trim();

  return {
    details: {
      bookedOn: bookedOn.data,
      categoryId: values.categoryId,
      kind: values.kind,
      money: amount.money as Money,
      ...(description.length > 0 ? { description } : {}),
    },
    ok: true,
  };
}

export function isCategoryNameValid(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= 500;
}
