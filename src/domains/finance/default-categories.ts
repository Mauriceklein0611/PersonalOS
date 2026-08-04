import type { FinanceCategoryDetails } from "./model";

/**
 * Synthetische Startwerte. Sie sind vollständig editierbar und tragen keine
 * Annahme über die tatsächlichen Lebensumstände.
 */
export const defaultFinanceCategories: readonly FinanceCategoryDetails[] = [
  { kind: "income", name: "Einkommen" },
  { kind: "income", name: "Sonstige Einnahmen" },
  { kind: "expense", name: "Wohnen" },
  { kind: "expense", name: "Lebensmittel" },
  { kind: "expense", name: "Mobilität" },
  { kind: "expense", name: "Freizeit" },
  { kind: "expense", name: "Sonstige Ausgaben" },
];
