import { z } from "zod";

import {
  scoreSettingsSchema,
  scoreSnapshotSchema,
} from "../../db/schemas/domain-records";
import type { EntityMeta } from "../../db/types";
import type { CalendarDay } from "../../lib/dates/date-values";

export { scoreSettingsSchema, scoreSnapshotSchema };

export type ScoreSettings = z.infer<typeof scoreSettingsSchema>;
export type ScoreSnapshot = z.infer<typeof scoreSnapshotSchema>;
export type ScoreSnapshotDetails = Omit<ScoreSnapshot, keyof EntityMeta>;

/**
 * Bezeichner der Berechnung, siehe [ADR 0009](../../../docs/decisions/0009-life-score-v1.md).
 * Ein neuer Bezeichner ist Pflicht, sobald sich Eingaben, Formel,
 * Normalisierung, Zeitfenster, Mindestdaten, die Menge der Komponenten oder
 * die Standardgewichte ändern. Vom Nutzer geänderte Gewichte sind keine
 * Versionsänderung.
 */
export const lifeScoreEngineVersion = "life-score-v1";

/** Feste Reihenfolge; sie bestimmt die Reihenfolge im Ergebnis. */
export const scoreComponentKeys = [
  "focus",
  "habits",
  "wellbeing",
  "goals",
  "finance",
] as const;

export type ScoreComponentKey = (typeof scoreComponentKeys)[number];

export const defaultScoreWeights: Record<ScoreComponentKey, number> = {
  finance: 15,
  focus: 25,
  goals: 15,
  habits: 25,
  wellbeing: 20,
};

export type ScoreComponentConfig = {
  enabled: boolean;
  key: ScoreComponentKey;
  weight: number;
};

export type ScorePeriod = {
  from: CalendarDay;
  to: CalendarDay;
};

/** Eine nachvollziehbare Eingabe eines Teilwerts, nie eine Bewertung. */
export type ScoreEvidence = {
  metric: string;
  /** Rohwert der Domäne: Anzahl, Summe oder Quote zwischen 0 und 1. */
  value: number;
  sourceCount: number;
};

export type ScoreComponent = {
  /** Erklärt, worauf der Wert beruht oder warum keiner vorliegt. */
  basis: string;
  /** Wahr, wenn der Wert in Gesamtwert und Gewichtssumme eingeht. */
  contributes: boolean;
  enabled: boolean;
  inputs: ScoreEvidence[];
  key: ScoreComponentKey;
  /**
   * Zeitraum dieses Teilwerts. Finanzen weicht vom Sieben-Tage-Fenster ab,
   * weil Budgets monatlich definiert sind; die Oberfläche nennt das am Wert.
   */
  period: ScorePeriod;
  /** Anzahl der Datensätze, auf denen der Wert beruht. */
  sourceCount: number;
  /** 0 bis 100, oder `null` für „keine Aussage möglich“. Nie `0` als Ersatz. */
  value: number | null;
  weight: number;
};

export type LifeScoreResult = {
  /** Anteil der beitragenden an den aktivierten Komponenten, 0 bis 1. */
  completeness: number;
  components: ScoreComponent[];
  period: ScorePeriod;
  /** 0 bis 100, oder `null`, wenn keine Komponente beiträgt. */
  total: number | null;
  version: string;
};

/**
 * Ergänzt fehlende Komponenten aus den Standardwerten, damit eine
 * unvollständig gespeicherte Konfiguration keine Lücke im Ergebnis erzeugt.
 * Unbekannte Schlüssel bleiben außen vor; die Reihenfolge ist immer die von
 * `scoreComponentKeys`.
 */
export function resolveScoreComponents(
  components: readonly ScoreComponentConfig[] = [],
): ScoreComponentConfig[] {
  return scoreComponentKeys.map((key) => {
    const configured = components.find((component) => component.key === key);
    if (configured === undefined) {
      return { enabled: true, key, weight: defaultScoreWeights[key] };
    }
    return {
      enabled: configured.enabled,
      key,
      weight: configured.weight,
    };
  });
}

export function createDefaultScoreComponents(): ScoreComponentConfig[] {
  return resolveScoreComponents();
}

/**
 * Gerundet wird ausschließlich für die Anzeige und nur einmal. Alle Werte
 * sind nicht negativ, deshalb ist `Math.round` hier das kaufmännische Runden.
 */
export function roundScoreForDisplay(value: number | null): number | null {
  return value === null ? null : Math.round(value);
}

/** Hält einen Teilwert im zugesagten Bereich, auch bei Rundungsresten. */
export function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError("score value must be a finite number");
  }
  return Math.min(Math.max(value, 0), 100);
}

/**
 * Übersetzt ein Ergebnis in einen speicherbaren Snapshot. Gespeichert wird der
 * ungerundete Wert, damit die Anzeige später genauso rundet wie heute, und nur
 * die aktivierten Komponenten mit dem tatsächlich verwendeten Gewicht.
 * Abgeschaltete Komponenten waren keine Grundlage und gehören nicht hinein.
 */
export function toScoreSnapshotDetails(
  result: LifeScoreResult,
): ScoreSnapshotDetails {
  return {
    completeness: result.completeness,
    components: result.components
      .filter((component) => component.enabled)
      .map((component) => ({
        key: component.key,
        sourceCount: component.sourceCount,
        value: component.value ?? undefined,
        weight: component.weight,
      })),
    engineVersion: result.version,
    localDate: result.period.to,
    ...(result.total === null ? {} : { total: result.total }),
  };
}
