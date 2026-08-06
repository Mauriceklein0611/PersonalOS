import {
  addCalendarDays,
  calendarDayForInstant,
} from "../../lib/dates/calendar-days";
import type { CalendarDay } from "../../lib/dates/date-values";
import {
  calculateBudgetUsage,
  monthOfDay,
  shiftMonth,
} from "../finance/budget";
import { MixedCurrencyError } from "../finance/mixed-currency";
import type {
  MonthlyBudget,
  SavingsContribution,
  SavingsGoal,
  Transaction,
} from "../finance/model";
import { calculateSavingsProgress } from "../finance/savings";
import type { Goal, GoalMilestone } from "../goals/model";
import { calculateGoalProgress } from "../goals/progress";
import { calculateHabitFulfillment } from "../habits/metrics";
import type { Habit, HabitEntry } from "../habits/model";
import type { JournalEntry } from "../journal/model";
import type { Task, TaskPriority } from "../tasks/model";
import {
  clampScore,
  lifeScoreEngineVersion,
  resolveScoreComponents,
  type LifeScoreResult,
  type ScoreComponent,
  type ScoreComponentConfig,
  type ScoreComponentKey,
  type ScoreEvidence,
  type ScorePeriod,
} from "./score-model";

export type LifeScoreInput = {
  budgets: readonly MonthlyBudget[];
  contributions: readonly SavingsContribution[];
  goals: readonly Goal[];
  habitEntries: readonly HabitEntry[];
  habits: readonly Habit[];
  journalEntries: readonly JournalEntry[];
  milestones: readonly GoalMilestone[];
  savingsGoals: readonly SavingsGoal[];
  tasks: readonly Task[];
  transactions: readonly Transaction[];
};

export type LifeScoreContext = {
  /** Darf unvollständig sein; fehlende Komponenten kommen aus den Standards. */
  components?: readonly ScoreComponentConfig[];
  timeZone: string;
  today: CalendarDay;
};

/** Sieben Tage, weil jede Domäne bereits wöchentlich denkt. */
export const lifeScoreWindowDays = 7;

const minimumPlannedTasks = 3;
const minimumHabitTarget = 3;
const minimumWellbeingDays = 3;

const taskPriorityWeights: Record<TaskPriority, number> = {
  high: 3,
  low: 1,
  normal: 2,
};

const wellbeingScaleKeys = ["mood", "energy", "stress"] as const;

type WellbeingScaleKey = (typeof wellbeingScaleKeys)[number];

/** Das Ergebnis einer Komponente, bevor Gewicht und Konfiguration greifen. */
type ComponentEvidence = {
  basis: string;
  inputs: ScoreEvidence[];
  sourceCount: number;
  value: number | null;
};

export function getLifeScorePeriod(today: CalendarDay): ScorePeriod {
  return { from: addCalendarDays(today, 1 - lifeScoreWindowDays), to: today };
}

/**
 * Finanzen folgt dem laufenden Kalendermonat, weil Budgets monatlich definiert
 * sind. Ein Sieben-Tage-Ausschnitt eines Monatsbudgets wäre keine Budgettreue.
 */
export function getFinancePeriod(today: CalendarDay): ScorePeriod {
  const month = monthOfDay(today);
  return {
    from: `${month}-01`,
    to: addCalendarDays(`${shiftMonth(month, 1)}-01`, -1),
  };
}

/**
 * Berechnet den Life Score nach [ADR 0009](../../../docs/decisions/0009-life-score-v1.md).
 * Die Funktion ist rein: Sie liest ausschließlich, verändert keine Quelldaten
 * und kennt keine Uhrzeit außerhalb von `context.today` und `context.timeZone`.
 * Derselbe Input liefert deshalb immer dasselbe Ergebnis.
 */
export function calculateLifeScore(
  input: LifeScoreInput,
  context: LifeScoreContext,
): LifeScoreResult {
  const period = getLifeScorePeriod(context.today);
  const financePeriod = getFinancePeriod(context.today);
  const configs = resolveScoreComponents(context.components);

  const components = configs.map((config) =>
    buildComponent(config, input, {
      financePeriod,
      period,
      timeZone: context.timeZone,
    }),
  );

  return {
    completeness: calculateCompleteness(components),
    components,
    period,
    total: calculateTotal(components),
    version: lifeScoreEngineVersion,
  };
}

type ComponentScope = {
  financePeriod: ScorePeriod;
  period: ScorePeriod;
  timeZone: string;
};

function buildComponent(
  config: ScoreComponentConfig,
  input: LifeScoreInput,
  scope: ComponentScope,
): ScoreComponent {
  const period = config.key === "finance" ? scope.financePeriod : scope.period;
  // Eine abgeschaltete Komponente wird nicht gerechnet. Sie ist keine Lücke,
  // sondern eine Entscheidung, und darf deshalb auch keine Evidenz zeigen.
  const evidence = config.enabled
    ? calculateComponent(config.key, input, scope)
    : disabledEvidence();

  return {
    basis: evidence.basis,
    contributes: config.enabled && config.weight > 0 && evidence.value !== null,
    enabled: config.enabled,
    inputs: evidence.inputs,
    key: config.key,
    period,
    sourceCount: evidence.sourceCount,
    value: evidence.value === null ? null : clampScore(evidence.value),
    weight: config.weight,
  };
}

/**
 * Eine abgeschaltete Komponente wird nicht gerechnet und zeigt auch keine
 * Evidenz. Sie ist keine Lücke, sondern eine Entscheidung.
 */
function disabledEvidence(): ComponentEvidence {
  return {
    basis: "Diese Komponente ist abgeschaltet.",
    inputs: [],
    sourceCount: 0,
    value: null,
  };
}

function calculateComponent(
  key: ScoreComponentKey,
  input: LifeScoreInput,
  scope: ComponentScope,
): ComponentEvidence {
  switch (key) {
    case "focus":
      return calculateFocus(input.tasks, scope.period);
    case "habits":
      return calculateHabits(input.habits, input.habitEntries, scope.period);
    case "wellbeing":
      return calculateWellbeing(input.journalEntries, scope.period);
    case "goals":
      return calculateGoals(
        input.goals,
        input.milestones,
        scope.period,
        scope.timeZone,
      );
    case "finance":
      return calculateFinance(input, scope.financePeriod);
  }
}

/**
 * Aufgaben ohne `plannedDate` bleiben außen vor; sie sind eine Sammlung, keine
 * Zusage für diese Woche. Abgebrochene Aufgaben zählen weder im Zähler noch im
 * Nenner: Ein Abbruch ist eine Entscheidung, kein Versäumnis.
 */
function calculateFocus(
  tasks: readonly Task[],
  period: ScorePeriod,
): ComponentEvidence {
  const planned = tasks.filter(
    (task) =>
      task.archivedAt === undefined &&
      task.status !== "cancelled" &&
      task.plannedDate !== undefined &&
      task.plannedDate >= period.from &&
      task.plannedDate <= period.to,
  );
  const completed = planned.filter((task) => task.status === "completed");
  const plannedWeight = sumPriorityWeight(planned);
  const completedWeight = sumPriorityWeight(completed);

  const inputs: ScoreEvidence[] = [
    {
      metric: "plannedPriorityWeight",
      sourceCount: planned.length,
      value: plannedWeight,
    },
    {
      metric: "completedPriorityWeight",
      sourceCount: completed.length,
      value: completedWeight,
    },
  ];

  if (planned.length < minimumPlannedTasks || plannedWeight === 0) {
    return {
      basis: `Weniger als ${minimumPlannedTasks} geplante Aufgaben im Zeitraum.`,
      inputs,
      sourceCount: planned.length,
      value: null,
    };
  }

  return {
    basis: `${completed.length} von ${planned.length} geplanten Aufgaben erledigt, nach Priorität gewichtet.`,
    inputs,
    sourceCount: planned.length,
    value: (100 * completedWeight) / plannedWeight,
  };
}

function sumPriorityWeight(tasks: readonly Task[]): number {
  return tasks.reduce(
    (total, task) => total + taskPriorityWeights[task.priority],
    0,
  );
}

/**
 * Die Erfüllungsquote stammt bewusst aus der Habits-Domäne und wird nicht neu
 * erfunden: Zwei Quoten mit unterschiedlichen Regeln wären nicht erklärbar.
 * Übersprungene Tage bleiben dadurch im Nenner; sie werden getrennt
 * ausgewiesen, damit der Unterschied zu fehlenden Daten sichtbar bleibt.
 */
function calculateHabits(
  habits: readonly Habit[],
  entries: readonly HabitEntry[],
  period: ScorePeriod,
): ComponentEvidence {
  let done = 0;
  let skipped = 0;
  let target = 0;
  let habitCount = 0;

  for (const habit of habits) {
    if (habit.archivedAt !== undefined) continue;
    const fulfillment = calculateHabitFulfillment(
      habit,
      entries,
      period.from,
      period.to,
    );
    if (fulfillment.target === 0) continue;
    done += fulfillment.done;
    skipped += fulfillment.skipped;
    target += fulfillment.target;
    habitCount += 1;
  }

  const inputs: ScoreEvidence[] = [
    { metric: "target", sourceCount: habitCount, value: target },
    { metric: "done", sourceCount: habitCount, value: done },
    { metric: "skipped", sourceCount: habitCount, value: skipped },
  ];

  if (target < minimumHabitTarget) {
    return {
      basis: `Weniger als ${minimumHabitTarget} geplante Einheiten im Zeitraum.`,
      inputs,
      sourceCount: habitCount,
      value: null,
    };
  }

  const skippedNote =
    skipped === 0 ? "" : ` ${skipped} Einheiten wurden übersprungen.`;
  return {
    basis: `${done} von ${target} geplanten Einheiten erledigt.${skippedNote}`,
    inputs,
    sourceCount: habitCount,
    value: (100 * done) / target,
  };
}

/**
 * Nur die Skalen gehen ein, niemals Freitexte. Eine ausgelassene Skala ist
 * kein Wert: Sie fehlt im Mittelwert und wird nicht als 0 gelesen.
 * `productivity` bleibt in v1 außen vor, weil der Wert Fokus doppelt gewichten
 * würde.
 */
function calculateWellbeing(
  entries: readonly JournalEntry[],
  period: ScorePeriod,
): ComponentEvidence {
  const relevant = entries.filter(
    (entry) =>
      entry.archivedAt === undefined &&
      entry.localDate >= period.from &&
      entry.localDate <= period.to,
  );

  const normalized: number[] = [];
  const rawTotals = new Map<
    WellbeingScaleKey,
    { count: number; sum: number }
  >();
  const daysWithValue = new Set<CalendarDay>();

  for (const entry of relevant) {
    for (const key of wellbeingScaleKeys) {
      const value = entry[key];
      if (value === undefined) continue;
      normalized.push(normalizeWellbeingScale(key, value));
      const totals = rawTotals.get(key) ?? { count: 0, sum: 0 };
      rawTotals.set(key, { count: totals.count + 1, sum: totals.sum + value });
      daysWithValue.add(entry.localDate);
    }
  }

  const inputs: ScoreEvidence[] = [
    {
      metric: "daysWithSelfAssessment",
      sourceCount: relevant.length,
      value: daysWithValue.size,
    },
    ...wellbeingScaleKeys.flatMap((key) => {
      const totals = rawTotals.get(key);
      if (totals === undefined) return [];
      return [
        {
          metric: `${key}Mean`,
          sourceCount: totals.count,
          value: totals.sum / totals.count,
        },
      ];
    }),
  ];

  if (daysWithValue.size < minimumWellbeingDays || normalized.length === 0) {
    return {
      basis: `Weniger als ${minimumWellbeingDays} Tage mit Selbsteinschätzung im Zeitraum.`,
      inputs,
      sourceCount: daysWithValue.size,
      value: null,
    };
  }

  return {
    basis: `${daysWithValue.size} Tage mit insgesamt ${normalized.length} Skalenwerten.`,
    inputs,
    sourceCount: daysWithValue.size,
    value: 100 * mean(normalized),
  };
}

/** Hoher Stress bedeutet geringes Wohlbefinden und wird deshalb invertiert. */
function normalizeWellbeingScale(
  key: WellbeingScaleKey,
  value: number,
): number {
  return key === "stress" ? (5 - value) / 4 : (value - 1) / 4;
}

/**
 * Der Teilwert beschreibt einen Stand, keine Wochenleistung. Ziele, die
 * innerhalb des Zeitfensters angelegt wurden, zählen nicht mit: Ohne diese
 * Regel würde das Anlegen eines Ziels den Score senken.
 */
function calculateGoals(
  goals: readonly Goal[],
  milestones: readonly GoalMilestone[],
  period: ScorePeriod,
  timeZone: string,
): ComponentEvidence {
  const active = goals.filter(
    (goal) => goal.archivedAt === undefined && goal.status === "active",
  );
  const considered = active.filter(
    (goal) =>
      calendarDayForInstant(new Date(goal.createdAt), timeZone) < period.from,
  );
  const excludedCount = active.length - considered.length;

  const ratios = considered
    .map((goal) => calculateGoalProgress(goal, milestones).ratio)
    .filter((ratio): ratio is number => ratio !== null);

  const inputs: ScoreEvidence[] = [
    // Ohne Quote gibt es keinen Mittelwert; eine 0 wäre hier eine erfundene
    // Aussage über Ziele, für die nichts vorliegt.
    ...(ratios.length === 0
      ? []
      : [
          {
            metric: "meanProgress",
            sourceCount: ratios.length,
            value: mean(ratios),
          },
        ]),
    {
      metric: "goalsCreatedInPeriod",
      sourceCount: excludedCount,
      value: excludedCount,
    },
  ];

  const excludedNote =
    excludedCount === 0
      ? ""
      : " Neu angelegte Ziele zählen noch nicht mit, weil sie keine Gelegenheit für Fortschritt hatten.";

  if (ratios.length === 0) {
    return {
      basis: `Kein aktives Ziel mit Fortschrittsangabe.${excludedNote}`,
      inputs,
      sourceCount: 0,
      value: null,
    };
  }

  return {
    basis: `Fortschritt von ${ratios.length} aktiven Zielen.${excludedNote}`,
    inputs,
    sourceCount: ratios.length,
    value: 100 * mean(ratios),
  };
}

/**
 * Bewertet ausschließlich Budgettreue und Sparfortschritt. Kontostand,
 * Vermögen, Einkommenshöhe und Saldo gehen nicht ein. Weicht eine Währung ab,
 * wird der Teilwert `null` und der Grund benannt, statt umzurechnen.
 */
function calculateFinance(
  input: LifeScoreInput,
  period: ScorePeriod,
): ComponentEvidence {
  const month = monthOfDay(period.from);
  const budgets = input.budgets.filter(
    (budget) =>
      budget.archivedAt === undefined &&
      budget.month === month &&
      budget.limit.amountMinor > 0,
  );
  const savingsGoals = input.savingsGoals.filter(
    (goal) =>
      goal.archivedAt === undefined &&
      goal.status === "active" &&
      goal.target.amountMinor > 0,
  );

  let adherence: number | undefined;
  let savings: number | undefined;
  try {
    adherence =
      budgets.length === 0
        ? undefined
        : mean(
            budgets.map((budget) => {
              const usage = calculateBudgetUsage(budget, input.transactions);
              return usage.spentMinor <= usage.limitMinor
                ? 1
                : usage.limitMinor / usage.spentMinor;
            }),
          );
    savings =
      savingsGoals.length === 0
        ? undefined
        : mean(
            savingsGoals.map((goal) => {
              const progress = calculateSavingsProgress(
                goal,
                input.contributions,
              );
              // Bei 1 gekappt, sonst könnte ein übererfülltes Sparziel eine
              // Budgetüberschreitung rechnerisch aufwiegen.
              return Math.min(1, progress.savedMinor / progress.targetMinor);
            }),
          );
  } catch (error) {
    if (error instanceof MixedCurrencyError) {
      return {
        basis: error.message,
        inputs: [],
        sourceCount: 0,
        value: null,
      };
    }
    throw error;
  }

  const inputs: ScoreEvidence[] = [
    ...(adherence === undefined
      ? []
      : [
          {
            metric: "budgetAdherence",
            sourceCount: budgets.length,
            value: adherence,
          },
        ]),
    ...(savings === undefined
      ? []
      : [
          {
            metric: "savingsProgress",
            sourceCount: savingsGoals.length,
            value: savings,
          },
        ]),
  ];
  const sourceCount = budgets.length + savingsGoals.length;
  const subValues = inputs.map((evidence) => evidence.value);

  if (subValues.length === 0) {
    return {
      basis: "Kein Budget und kein aktives Sparziel im Monat.",
      inputs,
      sourceCount,
      value: null,
    };
  }

  return {
    basis: `Budgettreue und Sparfortschritt aus ${budgets.length} Budgets und ${savingsGoals.length} Sparzielen im Monat.`,
    inputs,
    sourceCount,
    value: 100 * mean(subValues),
  };
}

/**
 * Der Nenner enthält genau die Gewichte, die auch im Zähler stehen. Eine
 * fehlende Komponente verschiebt das Verhältnis der übrigen dadurch nicht und
 * senkt den Score nicht.
 */
function calculateTotal(components: readonly ScoreComponent[]): number | null {
  let weightedSum = 0;
  let weightSum = 0;
  for (const component of components) {
    if (!component.contributes || component.value === null) continue;
    weightedSum += component.weight * component.value;
    weightSum += component.weight;
  }
  return weightSum === 0 ? null : clampScore(weightedSum / weightSum);
}

/**
 * Deaktivierte Komponenten zählen in keinem der beiden Werte. Wer Finanzen
 * abschaltet, hat deshalb keine Lücke, sondern eine kleinere Grundlage.
 */
function calculateCompleteness(components: readonly ScoreComponent[]): number {
  const expected = components.filter(
    (component) => component.enabled && component.weight > 0,
  );
  if (expected.length === 0) return 0;
  return (
    expected.filter((component) => component.contributes).length /
    expected.length
  );
}

function mean(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

/**
 * Wendet andere Gewichte auf bereits berechnete Teilwerte an. Die Teilwerte
 * selbst hängen nicht von der Gewichtung ab, deshalb braucht eine Vorschau
 * keinen erneuten Lesezugriff auf die Quelldaten. Gerechnet wird mit denselben
 * Regeln wie in `calculateLifeScore`, damit Vorschau und gespeicherter Stand
 * nicht auseinanderlaufen können.
 */
export function applyScoreWeights(
  result: LifeScoreResult,
  components: readonly ScoreComponentConfig[],
): LifeScoreResult {
  const configs = resolveScoreComponents(components);
  const next = result.components.map((component) => {
    const config = configs.find((entry) => entry.key === component.key);
    const enabled = config?.enabled ?? component.enabled;
    const weight = config?.weight ?? component.weight;
    const evidence = enabled ? component : disabledEvidence();
    return {
      ...component,
      ...evidence,
      contributes: enabled && weight > 0 && evidence.value !== null,
      enabled,
      weight,
    };
  });

  return {
    completeness: calculateCompleteness(next),
    components: next,
    period: result.period,
    total: calculateTotal(next),
    version: result.version,
  };
}

/** Findet einen Teilwert im Ergebnis; die Reihenfolge ist immer dieselbe. */
export function findScoreComponent(
  result: LifeScoreResult,
  key: ScoreComponentKey,
): ScoreComponent {
  const component = result.components.find(
    (candidate) => candidate.key === key,
  );
  if (component === undefined) {
    throw new RangeError(`unknown score component: ${key}`);
  }
  return component;
}
