import type { Insight } from "./insight-model";
import {
  insightRules,
  type InsightContext,
  type InsightInput,
  type InsightRule,
} from "./insight-rules";

export type InsightRunResult = {
  insights: Insight[];
  /** IDs der Regeln, die nicht durchgelaufen sind. Nie stillschweigend leer. */
  failedRuleIds: string[];
};

/**
 * Führt alle Regeln aus. Der Lauf liest ausschließlich und verändert keine
 * Quelldaten; siehe [ADR 0010](../../../docs/decisions/0010-deterministic-insights-v1.md).
 *
 * Eine Regel, die wirft, nimmt die übrigen nicht mit. Sie wird stattdessen in
 * `failedRuleIds` benannt, damit ein Fehler sichtbar bleibt statt als „keine
 * Beobachtung“ durchzugehen.
 */
export function runInsightRules(
  input: InsightInput,
  context: InsightContext,
  rules: readonly InsightRule[] = insightRules,
): InsightRunResult {
  const insights: Insight[] = [];
  const failedRuleIds: string[] = [];

  for (const rule of rules) {
    try {
      insights.push(...rule.run(input, context));
    } catch {
      failedRuleIds.push(rule.id);
    }
  }

  return { failedRuleIds, insights: sortInsights(insights) };
}

const strengthOrder = { high: 0, low: 2, medium: 1 } as const;

/**
 * Deutliche Beobachtungen zuerst, fehlende Grundlagen zuletzt. Bei gleicher
 * Stärke entscheidet die ID, damit die Reihenfolge reproduzierbar bleibt.
 */
export function sortInsights(insights: readonly Insight[]): Insight[] {
  return [...insights].sort(
    (left, right) =>
      strengthOrder[left.strength] - strengthOrder[right.strength] ||
      left.id.localeCompare(right.id),
  );
}

/** Ausblenden entfernt nur die Darstellung; die Regel läuft weiter. */
export function withoutHiddenInsights(
  insights: readonly Insight[],
  hiddenIds: ReadonlySet<string>,
): Insight[] {
  return insights.filter((insight) => !hiddenIds.has(insight.id));
}
