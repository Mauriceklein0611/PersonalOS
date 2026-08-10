import { monthOfDay } from "./budget";
import type { FinanceCategory, Transaction } from "./model";
import type { DueRecurringTransaction } from "./recurring";

/**
 * Eine Prognose ist eine Schätzung und wird auch so benannt. Sie erscheint
 * **nicht**, solange die Grundlage fehlt — eine Zahl aus einem einzigen Monat
 * wäre keine Schätzung, sondern eine Behauptung mit Nachkommastellen.
 */
export type MonthForecast =
  | { kind: "unavailable"; reason: string }
  | {
      kind: "available";
      /** Die abgeschlossenen Monate, aus denen der Durchschnitt stammt. */
      basisMonths: string[];
      /** Durchschnittliche variable Ausgaben dieser Monate. */
      averageVariableMinor: number;
      /** Bereits in diesem Monat gebuchte Ausgaben. */
      bookedExpenseMinor: number;
      bookedIncomeMinor: number;
      expectedBalanceMinor: number;
      expectedExpenseMinor: number;
      expectedIncomeMinor: number;
      /** Noch offene Fixkostenvorlagen dieses Monats. */
      openFixedMinor: number;
      /** Noch offene Einnahmevorlagen dieses Monats. */
      openIncomeMinor: number;
      /**
       * Was an variablen Ausgaben bis zum Monatsende noch erwartet wird: die
       * Lücke zum Durchschnitt, nie negativ. Liegt der Monat schon darüber,
       * wird nichts weiter angenommen statt rückwirkend zu kürzen.
       */
      expectedRemainingVariableMinor: number;
    };

/** Ohne zwei abgeschlossene Monate gibt es keinen Durchschnitt, der einer wäre. */
const minimumBasisMonths = 2;

export type MonthForecastInput = {
  categories: readonly FinanceCategory[];
  dueTemplates: readonly DueRecurringTransaction[];
  month: string;
  transactions: readonly Transaction[];
};

/**
 * Schätzt den Monatsabschluss aus drei Teilen: was schon gebucht ist, was
 * über die Vorlagen noch sicher kommt, und was an variablen Ausgaben nach
 * bisheriger Erfahrung noch zu erwarten ist.
 *
 * Die Funktion ist rein und liest ausschließlich; alle Beträge bleiben
 * ganzzahlige Minor Units.
 */
export function buildMonthForecast({
  categories,
  dueTemplates,
  month,
  transactions,
}: MonthForecastInput): MonthForecast {
  const active = transactions.filter(
    (transaction) => transaction.archivedAt === undefined,
  );
  const fixedCostIds = new Set(
    categories
      .filter(
        (category) =>
          category.kind === "expense" && category.isFixedCost === true,
      )
      .map((category) => category.id),
  );

  const basisMonths = [
    ...new Set(
      active
        .map((transaction) => monthOfDay(transaction.bookedOn))
        .filter((bookedMonth) => bookedMonth < month),
    ),
  ].sort();

  if (basisMonths.length < minimumBasisMonths) {
    return {
      kind: "unavailable",
      reason:
        basisMonths.length === 0
          ? "Für eine Schätzung fehlt jeder abgeschlossene Monat."
          : `Für eine Schätzung braucht es ${minimumBasisMonths} abgeschlossene Monate; bisher liegt ${basisMonths.length} vor.`,
    };
  }

  const variableOfMonth = (target: string) =>
    active
      .filter(
        (transaction) =>
          transaction.kind === "expense" &&
          monthOfDay(transaction.bookedOn) === target &&
          !fixedCostIds.has(transaction.categoryId),
      )
      .reduce((total, transaction) => total + transaction.money.amountMinor, 0);

  // Ganzzahlig gemittelt; ein Bruchteil eines Cents wäre eine Scheingenauigkeit.
  const averageVariableMinor = Math.round(
    basisMonths.reduce((total, target) => total + variableOfMonth(target), 0) /
      basisMonths.length,
  );

  const inMonth = active.filter(
    (transaction) => monthOfDay(transaction.bookedOn) === month,
  );
  const bookedExpenseMinor = sumKind(inMonth, "expense");
  const bookedIncomeMinor = sumKind(inMonth, "income");
  const bookedVariableMinor = variableOfMonth(month);

  const openFixedMinor = sumTemplates(
    dueTemplates,
    (due) =>
      due.template.kind === "expense" &&
      fixedCostIds.has(due.template.categoryId),
  );
  const openIncomeMinor = sumTemplates(
    dueTemplates,
    (due) => due.template.kind === "income",
  );

  const expectedRemainingVariableMinor = Math.max(
    0,
    averageVariableMinor - bookedVariableMinor,
  );

  const expectedExpenseMinor =
    bookedExpenseMinor + openFixedMinor + expectedRemainingVariableMinor;
  const expectedIncomeMinor = bookedIncomeMinor + openIncomeMinor;

  return {
    averageVariableMinor,
    basisMonths,
    bookedExpenseMinor,
    bookedIncomeMinor,
    expectedBalanceMinor: expectedIncomeMinor - expectedExpenseMinor,
    expectedExpenseMinor,
    expectedIncomeMinor,
    expectedRemainingVariableMinor,
    kind: "available",
    openFixedMinor,
    openIncomeMinor,
  };
}

function sumKind(
  transactions: readonly Transaction[],
  kind: Transaction["kind"],
): number {
  return transactions
    .filter((transaction) => transaction.kind === kind)
    .reduce((total, transaction) => total + transaction.money.amountMinor, 0);
}

function sumTemplates(
  dueTemplates: readonly DueRecurringTransaction[],
  matches: (due: DueRecurringTransaction) => boolean,
): number {
  return dueTemplates
    .filter(matches)
    .reduce((total, due) => total + due.template.money.amountMinor, 0);
}
