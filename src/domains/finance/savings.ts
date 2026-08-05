import type { CalendarDay } from "../../lib/dates/date-values";
import { MixedCurrencyError } from "./mixed-currency";
import type { SavingsContribution, SavingsGoal } from "./model";

export type SavingsProgressState = "open" | "reached" | "exceeded";

export type SavingsProgress = {
  contributionCount: number;
  currency: string;
  /** Negativ bedeutet Übererfüllung. Immer ganzzahlig. */
  openMinor: number;
  /** Anteil am Zielbetrag, oder `null` ohne Grundlage. */
  ratio: number | null;
  savedMinor: number;
  state: SavingsProgressState;
  /** Textliche Zusammenfassung; die Visualisierung ergänzt sie nur. */
  summary: string;
  targetMinor: number;
};

/**
 * Der aktuelle Betrag wird ausschließlich aus den Beiträgen berechnet und nie
 * gespeichert. Zurückgenommene, also archivierte, Beiträge zählen nicht mehr
 * mit. Alles läuft über ganzzahlige Minor Units; es wird nie umgerechnet.
 */
export function calculateSavingsProgress(
  goal: SavingsGoal,
  contributions: readonly SavingsContribution[],
): SavingsProgress {
  const relevant = contributions.filter(
    (contribution) =>
      contribution.archivedAt === undefined &&
      contribution.savingsGoalId === goal.id,
  );

  const foreign = relevant.find(
    (contribution) => contribution.money.currency !== goal.target.currency,
  );
  if (foreign) {
    throw new MixedCurrencyError(
      "Sparziel und Beiträge verwenden verschiedene Währungen. Eine Summe wäre nur mit einer Umrechnung möglich.",
    );
  }

  const savedMinor = relevant.reduce(
    (total, contribution) => total + contribution.money.amountMinor,
    0,
  );
  const targetMinor = goal.target.amountMinor;
  const openMinor = targetMinor - savedMinor;

  return {
    contributionCount: relevant.length,
    currency: goal.target.currency,
    openMinor,
    ratio: targetMinor === 0 ? null : savedMinor / targetMinor,
    savedMinor,
    state: toState(targetMinor, savedMinor),
    summary: toSummary(targetMinor, savedMinor, openMinor),
    targetMinor,
  };
}

function toState(
  targetMinor: number,
  savedMinor: number,
): SavingsProgressState {
  if (targetMinor === 0) return savedMinor > 0 ? "exceeded" : "reached";
  if (savedMinor > targetMinor) return "exceeded";
  if (savedMinor === targetMinor) return "reached";
  return "open";
}

/**
 * Sachliche Beschreibung. Ein Sparstand ist eine Information und kein Urteil
 * über den Nutzer; deshalb weder Lob noch Mahnung.
 */
function toSummary(
  targetMinor: number,
  savedMinor: number,
  openMinor: number,
): string {
  if (targetMinor === 0) {
    return savedMinor > 0
      ? "Für dieses Sparziel ist kein Zielbetrag gesetzt; es sind trotzdem Beiträge erfasst."
      : "Für dieses Sparziel ist kein Zielbetrag gesetzt.";
  }
  if (openMinor < 0) {
    return "Der Zielbetrag ist erreicht; darüber hinaus sind weitere Beiträge erfasst.";
  }
  if (openMinor === 0) {
    return "Der Zielbetrag ist genau erreicht.";
  }
  return "Ein Teil des Zielbetrags ist noch offen.";
}

export type SavingsDeadlineState = "none" | "upcoming" | "today" | "passed";

/**
 * Beschreibt die Frist sachlich. Ein Sparziel ohne Frist ist ein gültiger
 * Zustand, und eine verstrichene Frist ist ein Hinweis, kein Versäumnis.
 */
export function describeSavingsDeadline(
  goal: SavingsGoal,
  today: CalendarDay,
): { state: SavingsDeadlineState; text: string } {
  if (goal.targetDate === undefined) {
    return { state: "none", text: "Ohne Frist" };
  }
  if (goal.status !== "active") {
    return { state: "none", text: `Frist war ${goal.targetDate}` };
  }
  if (goal.targetDate === today) {
    return { state: "today", text: "Frist ist heute" };
  }
  if (goal.targetDate < today) {
    return { state: "passed", text: "Frist liegt zurück" };
  }
  return { state: "upcoming", text: `Frist ${goal.targetDate}` };
}

/** Der Verlauf zeigt den jüngsten Beitrag zuerst; gleiche Tage stabil danach. */
export function sortContributions(
  contributions: readonly SavingsContribution[],
): SavingsContribution[] {
  return [...contributions].sort(
    (left, right) =>
      right.bookedOn.localeCompare(left.bookedOn) ||
      right.createdAt.localeCompare(left.createdAt) ||
      left.id.localeCompare(right.id),
  );
}
