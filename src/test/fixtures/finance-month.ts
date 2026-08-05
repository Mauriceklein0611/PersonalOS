import type {
  MonthlyBudget,
  SavingsContribution,
  SavingsGoal,
  Transaction,
} from "../../domains/finance/model";

/**
 * Golden Fixture für die Monatsübersicht. Die erwarteten Summen in
 * `expectedAugust` sind von Hand gerechnet und absichtlich nicht aus dem
 * Produktionscode abgeleitet — sonst würde der Test einen Rechenfehler
 * mitmachen statt ihn zu finden.
 *
 * Alle Namen und Beträge sind erfunden.
 */
const id = (suffix: string) => `00000000-0000-4000-8000-${suffix}`;
const instant = "2026-08-01T08:00:00.000Z";

export const financeMonthCategories = {
  groceries: id("000000009001"),
  leisure: id("000000009002"),
  rent: id("000000009003"),
  salary: id("000000009004"),
};

const meta = (suffix: string) => ({
  createdAt: instant,
  id: id(suffix),
  updatedAt: instant,
});

function transaction(
  suffix: string,
  kind: Transaction["kind"],
  amountMinor: number,
  categoryId: string,
  bookedOn: string,
): Transaction {
  return {
    ...meta(suffix),
    bookedOn,
    categoryId,
    kind,
    money: { amountMinor, currency: "EUR" },
  } as Transaction;
}

export const financeMonthTransactions: Transaction[] = [
  // August: Einnahmen 2.400,00 €
  transaction(
    "000000009101",
    "income",
    240_000,
    financeMonthCategories.salary,
    "2026-08-01",
  ),
  // August: Ausgaben 680,00 + 245,50 + 132,00 + 45,50 = 1.103,00 €
  transaction(
    "000000009102",
    "expense",
    68_000,
    financeMonthCategories.rent,
    "2026-08-02",
  ),
  transaction(
    "000000009103",
    "expense",
    24_550,
    financeMonthCategories.groceries,
    "2026-08-04",
  ),
  transaction(
    "000000009104",
    "expense",
    13_200,
    financeMonthCategories.leisure,
    "2026-08-11",
  ),
  transaction(
    "000000009105",
    "expense",
    4_550,
    financeMonthCategories.groceries,
    "2026-08-19",
  ),
  // Juli: Ausgaben 680,00 + 310,00 = 990,00 €
  transaction(
    "000000009106",
    "expense",
    68_000,
    financeMonthCategories.rent,
    "2026-07-02",
  ),
  transaction(
    "000000009107",
    "expense",
    31_000,
    financeMonthCategories.groceries,
    "2026-07-15",
  ),
  // September liegt außerhalb und darf keine Summe beeinflussen.
  transaction(
    "000000009108",
    "expense",
    99_900,
    financeMonthCategories.leisure,
    "2026-09-03",
  ),
];

export const financeMonthBudgets: MonthlyBudget[] = [
  {
    ...meta("000000009201"),
    categoryId: financeMonthCategories.groceries,
    limit: { amountMinor: 30_000, currency: "EUR" },
    month: "2026-08",
  } as MonthlyBudget,
  {
    ...meta("000000009202"),
    categoryId: financeMonthCategories.leisure,
    limit: { amountMinor: 10_000, currency: "EUR" },
    month: "2026-08",
  } as MonthlyBudget,
];

export const financeMonthSavingsGoals: SavingsGoal[] = [
  {
    ...meta("000000009301"),
    name: "Synthetische Rücklage",
    status: "active",
    target: { amountMinor: 100_000, currency: "EUR" },
  } as SavingsGoal,
  {
    ...meta("000000009302"),
    name: "Abgeschlossenes Sparziel",
    status: "completed",
    target: { amountMinor: 50_000, currency: "EUR" },
  } as SavingsGoal,
];

export const financeMonthContributions: SavingsContribution[] = [
  {
    ...meta("000000009401"),
    bookedOn: "2026-08-05",
    money: { amountMinor: 25_000, currency: "EUR" },
    savingsGoalId: id("000000009301"),
  } as SavingsContribution,
  {
    ...meta("000000009402"),
    bookedOn: "2026-07-05",
    money: { amountMinor: 10_000, currency: "EUR" },
    savingsGoalId: id("000000009301"),
  } as SavingsContribution,
  // Beitrag zum abgeschlossenen Ziel; er zählt nicht in den Kurzstatus.
  {
    ...meta("000000009403"),
    bookedOn: "2026-08-06",
    money: { amountMinor: 50_000, currency: "EUR" },
    savingsGoalId: id("000000009302"),
  } as SavingsContribution,
];

/** Von Hand gerechnete Erwartung für August 2026. */
export const expectedAugust = {
  balanceMinor: 240_000 - 110_300,
  /** Budgets: 300,00 + 100,00 = 400,00 €; verbraucht 245,50 + 45,50 + 132,00. */
  budget: {
    limitMinor: 40_000,
    remainingMinor: 40_000 - 42_300,
    spentMinor: 42_300,
    trackedCategoryCount: 2,
  },
  expenseMinor: 110_300,
  incomeMinor: 240_000,
  /** Ausgaben nach Kategorie, absteigend. */
  expenseByCategory: [
    {
      amountMinor: 68_000,
      categoryId: financeMonthCategories.rent,
      transactionCount: 1,
    },
    {
      amountMinor: 29_100,
      categoryId: financeMonthCategories.groceries,
      transactionCount: 2,
    },
    {
      amountMinor: 13_200,
      categoryId: financeMonthCategories.leisure,
      transactionCount: 1,
    },
  ],
  previousExpenseMinor: 99_000,
  /** 1.103,00 − 990,00 = 113,00 € mehr als im Juli. */
  previousDifferenceMinor: 11_300,
  /**
   * Der Sparstand ist kumulativ und nicht auf den Monat begrenzt: 250,00 aus
   * August plus 100,00 aus Juli. Das abgeschlossene Ziel zählt nicht mit.
   */
  savings: { activeGoalCount: 1, savedMinor: 35_000, targetMinor: 100_000 },
  transactionCount: 5,
};
