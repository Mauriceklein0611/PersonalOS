import { MixedCurrencyError } from "./mixed-currency";
import type { MonthlyBudget, Transaction } from "./model";

export type BudgetUsageState = "within" | "reached" | "exceeded";

export type BudgetUsage = {
  categoryId: string;
  /** Anteil des Verbrauchs am Limit, oder `null` ohne Grundlage. */
  ratio: number | null;
  limitMinor: number;
  spentMinor: number;
  /** Negativ bedeutet Überschreitung. Immer ganzzahlig. */
  remainingMinor: number;
  currency: string;
  state: BudgetUsageState;
  /** Textliche Zusammenfassung; die Visualisierung ergänzt sie nur. */
  summary: string;
  transactionCount: number;
};

export function monthOfDay(day: string): string {
  return day.slice(0, 7);
}

/**
 * Zählt ausschließlich Ausgaben derselben Kategorie im gewählten lokalen
 * Monat. Alles läuft über ganzzahlige Minor Units; es wird nie umgerechnet.
 */
export function calculateBudgetUsage(
  budget: MonthlyBudget,
  transactions: readonly Transaction[],
): BudgetUsage {
  const relevant = transactions.filter(
    (transaction) =>
      transaction.archivedAt === undefined &&
      transaction.kind === "expense" &&
      transaction.categoryId === budget.categoryId &&
      monthOfDay(transaction.bookedOn) === budget.month,
  );

  const foreign = relevant.find(
    (transaction) => transaction.money.currency !== budget.limit.currency,
  );
  if (foreign) {
    throw new MixedCurrencyError(
      "Budget und Buchungen verwenden verschiedene Währungen. Eine Summe wäre nur mit einer Umrechnung möglich.",
    );
  }

  const spentMinor = relevant.reduce(
    (total, transaction) => total + transaction.money.amountMinor,
    0,
  );
  const limitMinor = budget.limit.amountMinor;
  const remainingMinor = limitMinor - spentMinor;

  return {
    categoryId: budget.categoryId,
    currency: budget.limit.currency,
    limitMinor,
    ratio: limitMinor === 0 ? null : spentMinor / limitMinor,
    remainingMinor,
    spentMinor,
    state: toState(limitMinor, spentMinor),
    summary: toSummary(limitMinor, spentMinor, remainingMinor),
    transactionCount: relevant.length,
  };
}

function toState(limitMinor: number, spentMinor: number): BudgetUsageState {
  if (limitMinor === 0) return spentMinor > 0 ? "exceeded" : "within";
  if (spentMinor > limitMinor) return "exceeded";
  if (spentMinor === limitMinor) return "reached";
  return "within";
}

/**
 * Sachliche Beschreibung. Eine Überschreitung ist eine Information, kein
 * Vorwurf, und bekommt deshalb keinen Schamtext.
 */
function toSummary(
  limitMinor: number,
  spentMinor: number,
  remainingMinor: number,
): string {
  if (limitMinor === 0) {
    return spentMinor > 0
      ? "Für diese Kategorie ist kein Betrag vorgesehen; es sind trotzdem Ausgaben gebucht."
      : "Für diese Kategorie ist kein Betrag vorgesehen.";
  }
  if (remainingMinor < 0) {
    return "Das Budget ist aufgebraucht; darüber hinaus sind weitere Ausgaben gebucht.";
  }
  if (remainingMinor === 0) {
    return "Das Budget ist genau aufgebraucht.";
  }
  return "Ein Teil des Budgets ist noch offen.";
}

/** Findet das Budget einer Kategorie im Monat; höchstens eines ist aktiv. */
export function findBudget(
  budgets: readonly MonthlyBudget[],
  month: string,
  categoryId: string,
): MonthlyBudget | undefined {
  return budgets.find(
    (budget) =>
      budget.archivedAt === undefined &&
      budget.month === month &&
      budget.categoryId === categoryId,
  );
}

export function shiftMonth(month: string, offset: number): string {
  const [yearText = "1970", monthText = "01"] = month.split("-");
  const year = Number.parseInt(yearText, 10);
  const index = Number.parseInt(monthText, 10) - 1 + offset;
  const shiftedYear = year + Math.floor(index / 12);
  const shiftedMonth = ((index % 12) + 12) % 12;
  return `${String(shiftedYear).padStart(4, "0")}-${String(shiftedMonth + 1).padStart(2, "0")}`;
}
