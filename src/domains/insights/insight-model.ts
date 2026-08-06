import { z } from "zod";

import {
  hiddenInsightDetailsSchema,
  hiddenInsightSchema,
} from "../../db/schemas/domain-records";
import type { CalendarDay } from "../../lib/dates/date-values";

export { hiddenInsightDetailsSchema, hiddenInsightSchema };

export type HiddenInsight = z.infer<typeof hiddenInsightSchema>;
export type HiddenInsightDetails = z.infer<typeof hiddenInsightDetailsSchema>;

export const insightStrengths = ["low", "medium", "high"] as const;

/**
 * `low` heißt „zu wenig Grundlage“, nicht „schwaches Ergebnis“. Unterhalb der
 * Mindestdaten einer Regel entsteht niemals `medium` oder `high`; siehe
 * [ADR 0010](../../../docs/decisions/0010-deterministic-insights-v1.md).
 */
export type InsightStrength = (typeof insightStrengths)[number];

export type InsightPeriod = {
  from: CalendarDay;
  to: CalendarDay;
};

/** Eine nachvollziehbare Zahl hinter der Beobachtung, nie eine Bewertung. */
export type InsightEvidence = {
  metric: string;
  value: number;
  sourceCount: number;
};

export type InsightAction = {
  kind: string;
  targetId?: string;
};

export type Insight = {
  /** Stabil aus Regel, Version, Zeitraum und Gegenstand abgeleitet. */
  id: string;
  ruleId: string;
  ruleVersion: string;
  period: InsightPeriod;
  evidence: InsightEvidence[];
  strength: InsightStrength;
  /** Fertiger deutscher Satz in Beobachtungssprache, ohne Ursachenbehauptung. */
  message: string;
  action?: InsightAction;
};

/**
 * Lesbar statt gehasht: Ein ausgeblendeter Datensatz bleibt so auch in einem
 * Export nachvollziehbar. Eine neue Regelversion erzeugt eine neue ID und
 * damit einen neuen Insight.
 */
export function createInsightId(
  ruleId: string,
  ruleVersion: string,
  period: InsightPeriod,
  subject = "",
): string {
  return `${ruleId}:${ruleVersion}:${period.from}:${period.to}:${subject}`;
}

export const insightStrengthLabels: Record<InsightStrength, string> = {
  high: "Deutlich erkennbar",
  low: "Noch zu wenig Grundlage",
  medium: "Erkennbar",
};

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)} %`;
}
