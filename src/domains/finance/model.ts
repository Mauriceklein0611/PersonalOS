import { z } from "zod";

import {
  financeCategoryDetailsSchema,
  financeCategorySchema,
  monthlyBudgetDetailsSchema,
  monthlyBudgetSchema,
  recurringTransactionDetailsSchema,
  recurringTransactionSchema,
  savingsContributionDetailsSchema,
  savingsContributionSchema,
  savingsGoalDetailsSchema,
  savingsGoalSchema,
  transactionDetailsSchema,
  transactionSchema,
} from "../../db/schemas/domain-records";

export {
  financeCategoryDetailsSchema,
  financeCategorySchema,
  monthlyBudgetDetailsSchema,
  monthlyBudgetSchema,
  recurringTransactionDetailsSchema,
  recurringTransactionSchema,
  savingsContributionDetailsSchema,
  savingsContributionSchema,
  savingsGoalDetailsSchema,
  savingsGoalSchema,
  transactionDetailsSchema,
  transactionSchema,
};

export type MonthlyBudget = z.infer<typeof monthlyBudgetSchema>;
export type MonthlyBudgetDetails = z.infer<typeof monthlyBudgetDetailsSchema>;

export type FinanceCategory = z.infer<typeof financeCategorySchema>;
export type FinanceCategoryDetails = z.infer<
  typeof financeCategoryDetailsSchema
>;
export type Transaction = z.infer<typeof transactionSchema>;
export type TransactionDetails = z.infer<typeof transactionDetailsSchema>;
export type RecurringTransaction = z.infer<typeof recurringTransactionSchema>;
export type RecurringTransactionDetails = z.infer<
  typeof recurringTransactionDetailsSchema
>;
export type FinanceKind = Transaction["kind"];

export const financeKinds = ["income", "expense"] as const;

export const financeKindLabels: Record<FinanceKind, string> = {
  expense: "Ausgabe",
  income: "Einnahme",
};

export type SavingsGoal = z.infer<typeof savingsGoalSchema>;
export type SavingsGoalDetails = z.infer<typeof savingsGoalDetailsSchema>;
export type SavingsGoalStatus = SavingsGoal["status"];
export type SavingsContribution = z.infer<typeof savingsContributionSchema>;
export type SavingsContributionDetails = z.infer<
  typeof savingsContributionDetailsSchema
>;

export const savingsGoalStatuses = [
  "active",
  "completed",
  "cancelled",
] as const;

export const savingsGoalStatusLabels: Record<SavingsGoalStatus, string> = {
  active: "Aktiv",
  cancelled: "Abgebrochen",
  completed: "Abgeschlossen",
};
