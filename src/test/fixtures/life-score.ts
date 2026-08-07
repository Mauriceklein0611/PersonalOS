import type {
  MonthlyBudget,
  SavingsContribution,
  SavingsGoal,
  Transaction,
} from "../../domains/finance/model";
import type { Goal, GoalMilestone } from "../../domains/goals/model";
import type { Habit, HabitEntry } from "../../domains/habits/model";
import type { LifeScoreInput } from "../../domains/insights/score-engine";
import type { JournalEntry } from "../../domains/journal/model";
import type { Task } from "../../domains/tasks/model";

/**
 * Golden Fixture für Beispiel 1 aus
 * [ADR 0009](../../../docs/decisions/0009-life-score-v1.md) — die vollständige
 * Woche. Die erwarteten Werte in `expectedLifeScore` sind von Hand aus den
 * Formeln des ADR gerechnet und absichtlich nicht aus dem Produktionscode
 * abgeleitet; sonst würde der Test einen Rechenfehler mitmachen statt ihn zu
 * finden.
 *
 * Alle Namen, Daten und Beträge sind erfunden.
 */
const id = (suffix: string) => `00000000-0000-4000-8000-${suffix}`;
const instant = "2026-06-01T08:00:00.000Z";

const meta = (suffix: string, createdAt = instant) => ({
  createdAt,
  id: id(suffix),
  updatedAt: createdAt,
});

export const lifeScoreToday = "2026-08-06";
export const lifeScoreTimeZone = "Europe/Berlin";
export const lifeScorePeriod = { from: "2026-07-31", to: "2026-08-06" };
export const lifeScoreFinancePeriod = { from: "2026-08-01", to: "2026-08-31" };

const categories = {
  groceries: id("000000008001"),
  leisure: id("000000008002"),
  salary: id("000000008003"),
};

function task(
  suffix: string,
  priority: Task["priority"],
  status: Task["status"],
  plannedDate: string | undefined,
): Task {
  return {
    ...meta(suffix),
    priority,
    status,
    title: `Beispielaufgabe ${suffix.slice(-3)}`,
    ...(plannedDate === undefined ? {} : { plannedDate }),
    ...(status === "completed"
      ? { completedAt: "2026-08-05T17:00:00.000Z" }
      : {}),
  };
}

/**
 * 10 geplante Aufgaben: 2 × hoch, 5 × normal, 3 × niedrig. Erledigt sind
 * beide hohen und drei normale. Gewichtet ergibt das (6 + 6) von (6 + 10 + 3).
 * Die letzten vier Aufgaben prüfen die Ausschlüsse und dürfen die Quote nicht
 * verändern.
 */
export const lifeScoreTasks: Task[] = [
  task("000000008101", "high", "completed", "2026-08-01"),
  task("000000008102", "high", "completed", "2026-08-02"),
  task("000000008103", "normal", "completed", "2026-08-02"),
  task("000000008104", "normal", "completed", "2026-08-03"),
  task("000000008105", "normal", "completed", "2026-08-04"),
  task("000000008106", "normal", "open", "2026-08-05"),
  task("000000008107", "normal", "open", "2026-08-06"),
  task("000000008108", "low", "open", "2026-07-31"),
  task("000000008109", "low", "open", "2026-08-05"),
  task("000000008110", "low", "open", "2026-08-06"),
  // Abgebrochen: weder im Zähler noch im Nenner.
  task("000000008111", "high", "cancelled", "2026-08-03"),
  // Ohne Plandatum: eine Sammlung, keine Zusage für diese Woche.
  task("000000008112", "high", "open", undefined),
  // Vor dem Zeitfenster geplant.
  task("000000008113", "high", "completed", "2026-07-30"),
  // Archiviert.
  {
    ...task("000000008114", "high", "open", "2026-08-04"),
    archivedAt: "2026-08-04T12:00:00.000Z",
  },
];

function dailyHabit(suffix: string, name: string): Habit {
  return {
    ...meta(suffix),
    name,
    schedule: { kind: "daily" },
    startDate: "2026-06-01",
  };
}

/**
 * Zwei tägliche Gewohnheiten ergeben im Sieben-Tage-Fenster `target` 14.
 * Erledigt sind 7 + 4 = 11 Einheiten, eine Einheit ist übersprungen. Seit
 * [ADR 0012](../../../docs/decisions/0012-skip-keeps-the-streak.md) fällt sie
 * aus dem Nenner: `counted` ist 13.
 */
export const lifeScoreHabits: Habit[] = [
  dailyHabit("000000008201", "Morgens dehnen"),
  dailyHabit("000000008202", "Abends lesen"),
  {
    ...dailyHabit("000000008203", "Archivierte Gewohnheit"),
    archivedAt: "2026-07-01T09:00:00.000Z",
  },
  { ...dailyHabit("000000008204", "Startet später"), startDate: "2026-09-01" },
];

function habitEntry(
  suffix: string,
  habitId: string,
  localDate: string,
  status: HabitEntry["status"],
): HabitEntry {
  return { ...meta(suffix), habitId, localDate, status };
}

const stretching = id("000000008201");
const reading = id("000000008202");

export const lifeScoreHabitEntries: HabitEntry[] = [
  habitEntry("000000008301", stretching, "2026-07-31", "done"),
  habitEntry("000000008302", stretching, "2026-08-01", "done"),
  habitEntry("000000008303", stretching, "2026-08-02", "done"),
  habitEntry("000000008304", stretching, "2026-08-03", "done"),
  habitEntry("000000008305", stretching, "2026-08-04", "done"),
  habitEntry("000000008306", stretching, "2026-08-05", "done"),
  habitEntry("000000008307", stretching, "2026-08-06", "done"),
  habitEntry("000000008308", reading, "2026-07-31", "done"),
  habitEntry("000000008309", reading, "2026-08-01", "done"),
  habitEntry("000000008310", reading, "2026-08-02", "done"),
  habitEntry("000000008311", reading, "2026-08-03", "done"),
  habitEntry("000000008312", reading, "2026-08-04", "skipped"),
];

/**
 * Sechs Tage mit insgesamt zehn Skalenwerten: acht Werte normalisieren zu 0,75
 * und zwei zu 0,5, im Mittel also 0,70. Der Eintrag ohne Skala und der Eintrag
 * vor dem Zeitfenster dürfen die Mindestdaten nicht auffüllen.
 */
export const lifeScoreJournalEntries: JournalEntry[] = [
  { ...meta("000000008401"), energy: 4, localDate: "2026-07-31", mood: 4 },
  { ...meta("000000008402"), energy: 4, localDate: "2026-08-01", mood: 4 },
  { ...meta("000000008403"), energy: 4, localDate: "2026-08-02", mood: 4 },
  { ...meta("000000008404"), energy: 4, localDate: "2026-08-03", mood: 4 },
  { ...meta("000000008405"), localDate: "2026-08-04", stress: 3 },
  { ...meta("000000008406"), localDate: "2026-08-05", stress: 3 },
  {
    ...meta("000000008407"),
    body: "Nur Freitext, keine Selbsteinschätzung.",
    localDate: "2026-08-06",
  },
  { ...meta("000000008408"), localDate: "2026-07-25", mood: 1 },
];

function goal(
  suffix: string,
  status: Goal["status"],
  createdAt: string,
  progressMode: Goal["progressMode"] = "milestones",
): Goal {
  return {
    ...meta(suffix, createdAt),
    progressMode,
    status,
    title: `Beispielziel ${suffix.slice(-3)}`,
  };
}

const goalWithHalf = id("000000008501");
const goalWithQuarter = id("000000008502");

/**
 * Zwei berücksichtigte Ziele mit 0,50 und 0,25, im Mittel 0,375. Das pausierte
 * Ziel, das im Zeitfenster angelegte Ziel und das Ziel ohne Fortschrittsangabe
 * zählen nicht mit.
 */
export const lifeScoreGoals: Goal[] = [
  goal("000000008501", "active", instant),
  goal("000000008502", "active", instant),
  goal("000000008503", "paused", instant),
  goal("000000008504", "active", "2026-08-02T10:00:00.000Z"),
  goal("000000008505", "active", instant, "manual"),
];

function milestone(
  suffix: string,
  goalId: string,
  order: number,
  status: GoalMilestone["status"],
): GoalMilestone {
  return {
    ...meta(suffix),
    goalId,
    order,
    status,
    title: `Meilenstein ${order + 1}`,
    ...(status === "completed"
      ? { completedAt: "2026-07-15T12:00:00.000Z" }
      : {}),
  };
}

export const lifeScoreMilestones: GoalMilestone[] = [
  milestone("000000008601", goalWithHalf, 0, "completed"),
  milestone("000000008602", goalWithHalf, 1, "open"),
  milestone("000000008603", goalWithQuarter, 0, "completed"),
  milestone("000000008604", goalWithQuarter, 1, "open"),
  milestone("000000008605", goalWithQuarter, 2, "open"),
  milestone("000000008606", goalWithQuarter, 3, "open"),
];

/**
 * Budgettreue 1,0 — 250,00 € von 300,00 € verbraucht. Sparfortschritt 0,40 —
 * 400,00 € von 1.000,00 €. Der Teilwert ist ihr Mittel, also 0,70.
 */
export const lifeScoreBudgets: MonthlyBudget[] = [
  {
    ...meta("000000008701"),
    categoryId: categories.groceries,
    limit: { amountMinor: 30_000, currency: "EUR" },
    month: "2026-08",
  },
  // Ohne Betrag hat eine Quote keine Bedeutung.
  {
    ...meta("000000008702"),
    categoryId: categories.leisure,
    limit: { amountMinor: 0, currency: "EUR" },
    month: "2026-08",
  },
  // Anderer Monat.
  {
    ...meta("000000008703"),
    categoryId: categories.groceries,
    limit: { amountMinor: 20_000, currency: "EUR" },
    month: "2026-07",
  },
];

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
  };
}

export const lifeScoreTransactions: Transaction[] = [
  transaction(
    "000000008801",
    "income",
    240_000,
    categories.salary,
    "2026-08-01",
  ),
  transaction(
    "000000008802",
    "expense",
    25_000,
    categories.groceries,
    "2026-08-03",
  ),
  transaction(
    "000000008803",
    "expense",
    5_000,
    categories.leisure,
    "2026-08-02",
  ),
  transaction(
    "000000008804",
    "expense",
    18_000,
    categories.groceries,
    "2026-07-20",
  ),
];

export const lifeScoreSavingsGoals: SavingsGoal[] = [
  {
    ...meta("000000008901"),
    name: "Notgroschen",
    status: "active",
    target: { amountMinor: 100_000, currency: "EUR" },
  },
  {
    ...meta("000000008902"),
    name: "Abgeschlossenes Sparziel",
    status: "completed",
    target: { amountMinor: 50_000, currency: "EUR" },
  },
];

export const lifeScoreContributions: SavingsContribution[] = [
  {
    ...meta("000000008911"),
    bookedOn: "2026-07-05",
    money: { amountMinor: 25_000, currency: "EUR" },
    savingsGoalId: id("000000008901"),
  },
  {
    ...meta("000000008912"),
    bookedOn: "2026-08-04",
    money: { amountMinor: 15_000, currency: "EUR" },
    savingsGoalId: id("000000008901"),
  },
];

export const lifeScoreInput: LifeScoreInput = {
  budgets: lifeScoreBudgets,
  contributions: lifeScoreContributions,
  goals: lifeScoreGoals,
  habitEntries: lifeScoreHabitEntries,
  habits: lifeScoreHabits,
  journalEntries: lifeScoreJournalEntries,
  milestones: lifeScoreMilestones,
  savingsGoals: lifeScoreSavingsGoals,
  tasks: lifeScoreTasks,
  transactions: lifeScoreTransactions,
};

/**
 * Von Hand gerechnet, siehe Beispiel 1 im ADR und die Neuberechnung der
 * Habits-Komponente in
 * [ADR 0012](../../../docs/decisions/0012-skip-keeps-the-streak.md):
 *
 * ```
 * focus     = 100 × 12 / 19       = 63,157894…
 * habits    = 100 × 11 / 13       = 84,615384…   (14 geplant, 1 übersprungen)
 * wellbeing = 100 × 0,70          = 70
 * goals     = 100 × 0,375         = 37,5
 * finance   = 100 × (1 + 0,4) / 2 = 70
 * total     = (25×63,157894… + 25×84,615384… + 20×70 + 15×37,5 + 15×70) / 100
 * ```
 */
export const expectedLifeScore = {
  completeness: 1,
  displayedTotal: 67,
  finance: 70,
  focus: 63.157_894_736_842_1,
  goals: 37.5,
  habits: 84.615_384_615_384_61,
  total: 67.068_319_838_056_68,
  wellbeing: 70,
};
