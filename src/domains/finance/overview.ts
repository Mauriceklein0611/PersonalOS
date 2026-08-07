import {
  createMoney,
  subtractMoney,
  sumMoney,
  type Money,
} from "../../lib/money/money";
import { findBudget, monthOfDay, shiftMonth } from "./budget";
import { MixedCurrencyError } from "./mixed-currency";
import type {
  MonthlyBudget,
  SavingsContribution,
  SavingsGoal,
  Transaction,
} from "./model";
import { calculateSavingsProgress } from "./savings";

/** Anteil einer Kategorie an den Ausgaben des Monats. */
export type CategoryShare = {
  amountMinor: number;
  categoryId: string;
  /** Anteil an den Gesamtausgaben, oder `null` ohne Grundlage. */
  ratio: number | null;
  transactionCount: number;
};

/**
 * Der Vergleich nennt entweder eine Differenz oder den Grund, warum keiner
 * möglich ist. Eine fehlende Grundlage wird niemals als 0 Prozent ausgegeben.
 */
export type MonthComparison =
  | {
      kind: "available";
      /** Negativ bedeutet weniger als im Vormonat. Immer ganzzahlig. */
      differenceMinor: number;
      previousMinor: number;
      /** Relative Änderung, oder `null`, wenn der Vormonat bei null lag. */
      ratio: number | null;
    }
  | { kind: "unavailable"; reason: string };

export type BudgetSummary = {
  limitMinor: number;
  /** Negativ bedeutet Überschreitung. Immer ganzzahlig. */
  remainingMinor: number;
  spentMinor: number;
  trackedCategoryCount: number;
};

export type SavingsSummary = {
  /** Nur die Ziele, die in `savedMinor` und `targetMinor` enthalten sind. */
  activeGoalCount: number;
  /** Aktive Ziele in einer anderen Währung; sie sind in keiner Summe. */
  excludedGoalCount: number;
  ratio: number | null;
  savedMinor: number;
  targetMinor: number;
};

/**
 * Die Sparbewegungen dieses Monats. `linkedMinor` steckt bereits in
 * `expense`; der Betrag ist gebunden, aber nicht zusätzlich abzuziehen.
 * `unlinkedMinor` kennt der Zahlungsfluss dagegen nicht: Diese Beträge sind
 * abgeflossen, ohne als Ausgabe erfasst zu sein.
 */
export type MonthlySavingsFlow = {
  contributionCount: number;
  linkedMinor: number;
  totalMinor: number;
  unlinkedMinor: number;
};

export type MonthlyOverview = {
  balanceMinor: number;
  /** Saldo abzüglich der Sparbeiträge, die keine Ausgabe belegt. */
  balanceAfterSavingsMinor: number;
  /** Fehlt, wenn für den Monat kein Budget gesetzt ist. */
  budget: BudgetSummary | undefined;
  currency: string;
  expense: Money;
  /** Absteigend nach Betrag; nur Ausgaben, nur nicht archivierte Buchungen. */
  expenseByCategory: CategoryShare[];
  income: Money;
  month: string;
  previousExpense: MonthComparison;
  savings: SavingsSummary;
  savingsThisMonth: MonthlySavingsFlow;
  transactionCount: number;
};

export type MonthlyOverviewInput = {
  budgets: readonly MonthlyBudget[];
  contributions: readonly SavingsContribution[];
  currency: string;
  month: string;
  savingsGoals: readonly SavingsGoal[];
  transactions: readonly Transaction[];
};

/**
 * Verdichtet einen Monat. Die Auswertung liest ausschließlich und verändert
 * keine Buchung; alle Beträge bleiben ganzzahlige Minor Units derselben
 * Währung. Abweichende Währungen werden benannt, nicht umgerechnet.
 */
export function buildMonthlyOverview({
  budgets,
  contributions,
  currency,
  month,
  savingsGoals,
  transactions,
}: MonthlyOverviewInput): MonthlyOverview {
  const active = transactions.filter(
    (transaction) => transaction.archivedAt === undefined,
  );
  assertSingleCurrency(active, currency);

  const inMonth = active.filter(
    (transaction) => monthOfDay(transaction.bookedOn) === month,
  );
  const income = sumOf(inMonth, "income", currency);
  const expense = sumOf(inMonth, "expense", currency);
  const balanceMinor = subtractMoney(income, expense);
  const savingsThisMonth = summariseSavingsFlow(
    contributions,
    inMonth,
    month,
    currency,
  );

  return {
    balanceAfterSavingsMinor: balanceMinor - savingsThisMonth.unlinkedMinor,
    balanceMinor,
    budget: summariseBudgets(budgets, inMonth, month, currency),
    currency,
    expense,
    expenseByCategory: rankExpenseCategories(inMonth, expense.amountMinor),
    income,
    month,
    previousExpense: compareWithPreviousMonth(active, month, currency),
    savings: summariseSavings(savingsGoals, contributions, currency),
    savingsThisMonth,
    transactionCount: inMonth.length,
  };
}

function assertSingleCurrency(
  transactions: readonly Transaction[],
  currency: string,
): void {
  if (transactions.some((entry) => entry.money.currency !== currency)) {
    throw new MixedCurrencyError(
      "Die Buchungen verwenden verschiedene Währungen. Eine Monatssumme wäre nur mit einer Umrechnung möglich.",
    );
  }
}

function sumOf(
  transactions: readonly Transaction[],
  kind: Transaction["kind"],
  currency: string,
): Money {
  return sumMoney(
    transactions
      .filter((transaction) => transaction.kind === kind)
      .map((transaction) => transaction.money),
    currency,
  );
}

function rankExpenseCategories(
  transactions: readonly Transaction[],
  expenseMinor: number,
): CategoryShare[] {
  const shares = new Map<string, CategoryShare>();

  for (const transaction of transactions) {
    if (transaction.kind !== "expense") continue;
    const current = shares.get(transaction.categoryId) ?? {
      amountMinor: 0,
      categoryId: transaction.categoryId,
      ratio: null,
      transactionCount: 0,
    };
    shares.set(transaction.categoryId, {
      ...current,
      amountMinor: current.amountMinor + transaction.money.amountMinor,
      transactionCount: current.transactionCount + 1,
    });
  }

  return [...shares.values()]
    .map((share) => ({
      ...share,
      // Ohne Ausgaben gibt es keinen Anteil; dann bleibt der Wert ohne Angabe.
      ratio: expenseMinor === 0 ? null : share.amountMinor / expenseMinor,
    }))
    .sort(
      (left, right) =>
        right.amountMinor - left.amountMinor ||
        left.categoryId.localeCompare(right.categoryId),
    );
}

/**
 * Ein Budget zählt nur, wenn es zum Monat gehört. Der Verbrauch stammt aus
 * denselben Buchungen wie die Monatssumme, damit beide Zahlen zueinander
 * passen.
 */
function summariseBudgets(
  budgets: readonly MonthlyBudget[],
  transactions: readonly Transaction[],
  month: string,
  currency: string,
): BudgetSummary | undefined {
  const relevant = budgets.filter(
    (budget) => budget.archivedAt === undefined && budget.month === month,
  );
  if (relevant.length === 0) return undefined;

  const foreign = relevant.find((budget) => budget.limit.currency !== currency);
  if (foreign) {
    throw new MixedCurrencyError(
      "Budget und Buchungen verwenden verschiedene Währungen. Eine Summe wäre nur mit einer Umrechnung möglich.",
    );
  }

  const limitMinor = relevant.reduce(
    (total, budget) => total + budget.limit.amountMinor,
    0,
  );
  const spentMinor = transactions
    .filter(
      (transaction) =>
        transaction.kind === "expense" &&
        findBudget(relevant, month, transaction.categoryId) !== undefined,
    )
    .reduce((total, transaction) => total + transaction.money.amountMinor, 0);

  return {
    limitMinor,
    remainingMinor: limitMinor - spentMinor,
    spentMinor,
    trackedCategoryCount: relevant.length,
  };
}

function compareWithPreviousMonth(
  transactions: readonly Transaction[],
  month: string,
  currency: string,
): MonthComparison {
  const previousMonth = shiftMonth(month, -1);
  const previous = transactions.filter(
    (transaction) => monthOfDay(transaction.bookedOn) === previousMonth,
  );

  if (previous.length === 0) {
    return {
      kind: "unavailable",
      reason: "Für den Vormonat ist keine Buchung erfasst.",
    };
  }

  const previousMinor = sumOf(previous, "expense", currency).amountMinor;
  const currentMinor = sumOf(
    transactions.filter(
      (transaction) => monthOfDay(transaction.bookedOn) === month,
    ),
    "expense",
    currency,
  ).amountMinor;

  return {
    differenceMinor: currentMinor - previousMinor,
    kind: "available",
    previousMinor,
    // Ohne Ausgaben im Vormonat gibt es keine relative Änderung.
    ratio:
      previousMinor === 0
        ? null
        : (currentMinor - previousMinor) / previousMinor,
  };
}

/**
 * Kurzstatus über die aktiven Sparziele der Übersichtswährung. Ein Ziel in
 * einer anderen Währung wird nicht umgerechnet und fließt in keine Summe ein;
 * es wird als `excludedGoalCount` ausgewiesen, damit die Oberfläche den
 * Ausschluss benennen kann. `activeGoalCount` zählt deshalb genau die Ziele
 * hinter `savedMinor` und `targetMinor`.
 */
function summariseSavings(
  goals: readonly SavingsGoal[],
  contributions: readonly SavingsContribution[],
  currency: string,
): SavingsSummary {
  const active = goals.filter(
    (goal) => goal.archivedAt === undefined && goal.status === "active",
  );
  const counted = active.filter((goal) => goal.target.currency === currency);

  let savedMinor = 0;
  let targetMinor = 0;
  for (const goal of counted) {
    const progress = calculateSavingsProgress(goal, contributions);
    savedMinor += progress.savedMinor;
    targetMinor += progress.targetMinor;
  }

  return {
    activeGoalCount: counted.length,
    excludedGoalCount: active.length - counted.length,
    ratio: targetMinor === 0 ? null : savedMinor / targetMinor,
    savedMinor,
    targetMinor,
  };
}

/**
 * Die Sparbeiträge des Monats, getrennt nach belegt und unbelegt. Ein Beitrag
 * gilt nur dann als belegt, wenn seine Ausgabe in genau diesem Monat aktiv
 * ist: Eine archivierte oder verschobene Buchung steckt nicht mehr in der
 * Monatssumme und darf den Beitrag deshalb nicht länger decken.
 */
function summariseSavingsFlow(
  contributions: readonly SavingsContribution[],
  monthTransactions: readonly Transaction[],
  month: string,
  currency: string,
): MonthlySavingsFlow {
  const expenseIds = new Set(
    monthTransactions
      .filter((transaction) => transaction.kind === "expense")
      .map((transaction) => transaction.id),
  );
  const inMonth = contributions.filter(
    (contribution) =>
      contribution.archivedAt === undefined &&
      contribution.money.currency === currency &&
      monthOfDay(contribution.bookedOn) === month,
  );

  let linkedMinor = 0;
  let unlinkedMinor = 0;
  for (const contribution of inMonth) {
    const isLinked =
      contribution.sourceTransactionId !== undefined &&
      expenseIds.has(contribution.sourceTransactionId);
    if (isLinked) {
      linkedMinor += contribution.money.amountMinor;
    } else {
      unlinkedMinor += contribution.money.amountMinor;
    }
  }

  return {
    contributionCount: inMonth.length,
    linkedMinor,
    totalMinor: linkedMinor + unlinkedMinor,
    unlinkedMinor,
  };
}

/** Betrag als `Money` derselben Währung, für die Darstellung. */
export function toMoney(amountMinor: number, currency: string): Money {
  return createMoney(Math.abs(amountMinor), currency);
}
