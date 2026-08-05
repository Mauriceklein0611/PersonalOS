import { z } from "zod";

import {
  financeCategoryDetailsSchema,
  financeCategorySchema,
  transactionDetailsSchema,
  transactionSchema,
} from "../../db/schemas/domain-records";

export {
  financeCategoryDetailsSchema,
  financeCategorySchema,
  transactionDetailsSchema,
  transactionSchema,
};

export type FinanceCategory = z.infer<typeof financeCategorySchema>;
export type FinanceCategoryDetails = z.infer<
  typeof financeCategoryDetailsSchema
>;
export type Transaction = z.infer<typeof transactionSchema>;
export type TransactionDetails = z.infer<typeof transactionDetailsSchema>;
export type FinanceKind = Transaction["kind"];

export const financeKinds = ["income", "expense"] as const;

export const financeKindLabels: Record<FinanceKind, string> = {
  expense: "Ausgabe",
  income: "Einnahme",
};
