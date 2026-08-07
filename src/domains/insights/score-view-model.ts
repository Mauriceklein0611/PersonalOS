import { noDataText } from "../../components/ui";
import { formatCalendarDay } from "../habits/view-model";
import {
  roundScoreForDisplay,
  type LifeScoreResult,
  type ScoreComponent,
  type ScoreComponentConfig,
  type ScoreComponentKey,
  type ScoreEvidence,
  type ScorePeriod,
} from "./score-model";

export const scoreComponentLabels: Record<ScoreComponentKey, string> = {
  finance: "Finanzen",
  focus: "Fokus",
  goals: "Ziele",
  habits: "Gewohnheiten",
  wellbeing: "Wohlbefinden",
};

/** Beschreibt, was gemessen wird — nie, wie gut es ist. */
export const scoreComponentDescriptions: Record<ScoreComponentKey, string> = {
  finance:
    "Wie nah deine Ausgaben an deinen Budgets liegen und wie weit deine Sparziele sind. Kontostand, Einkommen und Vermögen gehen nicht ein.",
  focus:
    "Wie viele der Aufgaben, die du für diese Tage geplant hattest, du abgeschlossen hast.",
  goals: "Wie weit deine aktiven Ziele fortgeschritten sind.",
  habits:
    "Wie viele der zählenden Einheiten deiner Gewohnheiten du erledigt hast. Bewusst übersprungene Einheiten zählen nicht mit.",
  wellbeing:
    "Der Durchschnitt deiner eigenen Angaben zu Stimmung, Energie und Stress.",
};

/** Die Formel in Worten. Sie ersetzt keine Zahl, sie erklärt sie. */
export const scoreComponentFormulas: Record<ScoreComponentKey, string> = {
  finance:
    "Mittelwert aus Budgettreue und Sparfortschritt. Ein überschrittenes Budget zählt als Limit geteilt durch Ausgaben, ein übererfülltes Sparziel wird bei 100 % gekappt.",
  focus:
    "Erledigte geteilt durch geplante Aufgaben, jede nach Priorität gewichtet: hoch zählt dreifach, normal zweifach, niedrig einfach. Abgebrochene Aufgaben zählen gar nicht.",
  goals:
    "Durchschnitt der Fortschrittsquoten deiner aktiven Ziele. Ziele, die du in diesem Zeitraum angelegt hast, zählen noch nicht mit.",
  habits:
    "Erledigte geteilt durch die zählenden Einheiten. Bewusst übersprungene Einheiten zählen weder im Zähler noch im Nenner; ein geplanter Tag ohne Eintrag bleibt im Nenner.",
  wellbeing:
    "Alle Angaben werden auf 0 bis 100 umgerechnet und gemittelt. Stress wird dabei umgekehrt: wenig Stress bedeutet hohes Wohlbefinden.",
};

/** Die Mindestdaten je Bereich, in derselben Sprache wie die Formel. */
export const scoreComponentMinimums: Record<ScoreComponentKey, string> = {
  finance: "Mindestens ein Budget oder ein aktives Sparziel im Monat.",
  focus: "Mindestens drei geplante Aufgaben im Zeitraum.",
  goals: "Mindestens ein aktives Ziel mit Fortschrittsangabe.",
  habits: "Mindestens drei zählende Einheiten im Zeitraum.",
  wellbeing: "Mindestens drei Tage mit eigener Einschätzung.",
};

const scoreMetricLabels: Record<string, string> = {
  budgetAdherence: "Budgettreue",
  completedPriorityWeight: "Erledigte Prioritätspunkte",
  counted: "Zählende Einheiten",
  daysWithSelfAssessment: "Tage mit eigener Einschätzung",
  done: "Erledigte Einheiten",
  energyMean: "Energie im Mittel",
  goalsCreatedInPeriod: "Im Zeitraum angelegte Ziele",
  meanProgress: "Fortschritt im Mittel",
  moodMean: "Stimmung im Mittel",
  plannedPriorityWeight: "Geplante Prioritätspunkte",
  savingsProgress: "Sparfortschritt",
  skipped: "Übersprungene Einheiten",
  stressMean: "Stress im Mittel",
  target: "Geplante Einheiten",
};

/** Werte zwischen 0 und 1 sind Quoten und werden als Prozent gelesen. */
const ratioMetrics = new Set([
  "budgetAdherence",
  "meanProgress",
  "savingsProgress",
]);

/** Werte auf der Journalskala von 1 bis 5. */
const scaleMetrics = new Set(["energyMean", "moodMean", "stressMean"]);

export type ScoreEvidenceRow = {
  label: string;
  value: string;
  sourceText: string;
};

export function describeEvidence(evidence: ScoreEvidence): ScoreEvidenceRow {
  return {
    label: scoreMetricLabels[evidence.metric] ?? evidence.metric,
    sourceText: `${evidence.sourceCount} ${evidence.sourceCount === 1 ? "Datensatz" : "Datensätze"}`,
    value: formatEvidenceValue(evidence),
  };
}

function formatEvidenceValue(evidence: ScoreEvidence): string {
  if (ratioMetrics.has(evidence.metric)) {
    return `${Math.round(evidence.value * 100)} %`;
  }
  if (scaleMetrics.has(evidence.metric)) {
    return `${formatDecimal(evidence.value)} von 5`;
  }
  return formatDecimal(evidence.value);
}

function formatDecimal(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace(".", ",");
}

/** Gerundeter Punktwert oder „Keine Angabe“. Niemals „0“ für fehlende Daten. */
export function formatScoreValue(value: number | null): string {
  const rounded = roundScoreForDisplay(value);
  return rounded === null ? noDataText : `${rounded} von 100`;
}

/** Anteil zwischen 0 und 1 für Ring und Balken, oder `null` ohne Grundlage. */
export function toScoreRatio(value: number | null): number | null {
  return value === null ? null : value / 100;
}

export function describePeriod(period: ScorePeriod): string {
  return `${formatCalendarDay(period.from)} bis ${formatCalendarDay(period.to)}`;
}

export function describeCompleteness(result: LifeScoreResult): string {
  const expected = result.components.filter(
    (component) => component.enabled && component.weight > 0,
  );
  const contributing = expected.filter((component) => component.contributes);
  if (expected.length === 0) {
    return "Kein Bereich ist einbezogen.";
  }
  return `${contributing.length} von ${expected.length} Bereichen`;
}

/**
 * Nennt den Anteil eines Gewichts an der Summe aller einbezogenen Gewichte.
 * Ohne diesen Bezug wäre „25“ eine Zahl ohne Bedeutung.
 */
export function describeWeightShare(
  components: readonly ScoreComponentConfig[],
  key: ScoreComponentKey,
): string {
  const config = components.find((component) => component.key === key);
  if (config === undefined || !config.enabled || config.weight === 0) {
    return "Zählt nicht mit.";
  }

  const total = components
    .filter((component) => component.enabled)
    .reduce((sum, component) => sum + component.weight, 0);
  if (total === 0) return "Zählt nicht mit.";
  return `${Math.round((config.weight / total) * 100)} % der Gewichtung`;
}

export type ScoreComponentView = {
  basis: string;
  component: ScoreComponent;
  description: string;
  evidence: ScoreEvidenceRow[];
  formula: string;
  label: string;
  minimum: string;
  periodText: string;
  ratio: number | null;
  valueText: string;
  weightText: string;
};

/**
 * Verdichtet einen Teilwert für die Darstellung. Der Zeitraum steht an jedem
 * Wert, weil Finanzen bewusst vom Sieben-Tage-Fenster abweicht.
 */
export function buildComponentView(
  component: ScoreComponent,
  components: readonly ScoreComponentConfig[],
): ScoreComponentView {
  return {
    basis: component.basis,
    component,
    description: scoreComponentDescriptions[component.key],
    evidence: component.inputs.map(describeEvidence),
    formula: scoreComponentFormulas[component.key],
    label: scoreComponentLabels[component.key],
    minimum: scoreComponentMinimums[component.key],
    periodText: describePeriod(component.period),
    ratio: toScoreRatio(component.value),
    valueText: formatScoreValue(component.value),
    weightText: describeWeightShare(components, component.key),
  };
}

export function buildComponentViews(
  result: LifeScoreResult,
  components: readonly ScoreComponentConfig[],
): ScoreComponentView[] {
  return result.components.map((component) =>
    buildComponentView(component, components),
  );
}
