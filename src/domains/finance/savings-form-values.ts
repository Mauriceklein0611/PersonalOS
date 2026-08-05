import {
  calendarDaySchema,
  type CalendarDay,
} from "../../lib/dates/date-values";
import { parseMoneyInput, type Money } from "../../lib/money/money";
import type {
  SavingsContributionDetails,
  SavingsGoalDetails,
  SavingsGoalStatus,
} from "./model";

const amountMessages: Record<string, string> = {
  empty: "Gib einen Betrag ein, zum Beispiel 250,00.",
  format: "Gib einen Betrag ohne Vorzeichen ein, zum Beispiel 250,00.",
  precision: "Gib höchstens zwei Nachkommastellen ein, zum Beispiel 250,00.",
};

export type SavingsGoalFormValues = {
  name: string;
  target: string;
  /** Leer bedeutet: ohne Frist. Das ist ein gültiger Zustand. */
  targetDate: string;
};

export type SavingsGoalFormErrors = Partial<
  Record<"name" | "target" | "targetDate", string>
>;

export type SavingsGoalFormResult =
  | { ok: true; details: SavingsGoalDetails }
  | { ok: false; errors: SavingsGoalFormErrors };

export function createSavingsGoalFormValues(): SavingsGoalFormValues {
  return { name: "", target: "", targetDate: "" };
}

export function toSavingsGoalDetails(
  values: SavingsGoalFormValues,
  currency: string,
  status: SavingsGoalStatus = "active",
): SavingsGoalFormResult {
  const errors: SavingsGoalFormErrors = {};

  const name = values.name.trim();
  if (name.length === 0 || name.length > 500) {
    errors.name = "Gib einen Namen mit mindestens einem Zeichen ein.";
  }

  const target = parseMoneyInput(values.target, currency);
  if (!target.ok) {
    errors.target = amountMessages[target.reason] ?? amountMessages.format;
  }

  const trimmedDate = values.targetDate.trim();
  const targetDate =
    trimmedDate.length === 0
      ? undefined
      : calendarDaySchema.safeParse(trimmedDate);
  if (targetDate !== undefined && !targetDate.success) {
    errors.targetDate = "Wähle ein gültiges Datum oder lass die Frist leer.";
  }

  if (!target.ok || (targetDate !== undefined && !targetDate.success)) {
    return { errors, ok: false };
  }
  if (Object.keys(errors).length > 0) {
    return { errors, ok: false };
  }

  return {
    details: {
      name,
      status,
      target: target.money as Money,
      ...(targetDate === undefined ? {} : { targetDate: targetDate.data }),
    },
    ok: true,
  };
}

export type ContributionFormValues = {
  amount: string;
  bookedOn: string;
  note: string;
};

export type ContributionFormErrors = Partial<
  Record<"amount" | "bookedOn", string>
>;

export type ContributionFormResult =
  | { ok: true; details: SavingsContributionDetails }
  | { ok: false; errors: ContributionFormErrors };

export function createContributionFormValues(
  today: CalendarDay,
): ContributionFormValues {
  return { amount: "", bookedOn: today, note: "" };
}

export function toContributionDetails(
  values: ContributionFormValues,
  savingsGoalId: string,
  currency: string,
): ContributionFormResult {
  const errors: ContributionFormErrors = {};

  const amount = parseMoneyInput(values.amount, currency);
  if (!amount.ok) {
    errors.amount = amountMessages[amount.reason] ?? amountMessages.format;
  }

  const bookedOn = calendarDaySchema.safeParse(values.bookedOn);
  if (!bookedOn.success) {
    errors.bookedOn = "Wähle ein gültiges Datum.";
  }

  if (!amount.ok || !bookedOn.success) {
    return { errors, ok: false };
  }

  const note = values.note.trim();

  return {
    details: {
      bookedOn: bookedOn.data,
      money: amount.money as Money,
      savingsGoalId,
      ...(note.length > 0 ? { note } : {}),
    },
    ok: true,
  };
}
