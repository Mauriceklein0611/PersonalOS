import { differenceInCalendarDays } from "../../lib/dates/calendar-days";
import {
  createMoney,
  formatMoney,
  formatSignedMinorUnits,
} from "../../lib/money/money";
import { calculateBudgetUsage, monthOfDay } from "../finance/budget";
import type {
  FinanceCategory,
  MonthlyBudget,
  SavingsContribution,
  SavingsGoal,
  Transaction,
} from "../finance/model";
import { calculateSavingsProgress } from "../finance/savings";
import type { TodayContext, TodayOverview } from "./queries";

export type TodaySignalKind =
  "budget" | "capacity" | "overdue" | "reflection" | "savings";

export type TodaySignal = {
  id: string;
  kind: TodaySignalKind;
  text: string;
  tone: "attention" | "info";
};

export type TodaySignalInput = {
  budgets: readonly MonthlyBudget[];
  categories: readonly FinanceCategory[];
  contributions: readonly SavingsContribution[];
  overview: TodayOverview;
  savingsGoals: readonly SavingsGoal[];
  transactions: readonly Transaction[];
};

/**
 * Höchstens drei Zeilen. Die Grenze ist der Punkt der ganzen Ebene: Ein
 * Dashboard, das mit der Datenmenge wächst, ist ein Bericht.
 */
export const maximumSignals = 3;

/** Ab hier meldet sich ein Budget, auch wenn es noch nicht überschritten ist. */
const budgetNoticeRatio = 0.8;

/** Eine Frist meldet sich, sobald sie in diesen Zeitraum rückt. */
const savingsDeadlineDays = 30;

/** Darunter gilt ein Sparziel als noch nicht auf Kurs. */
const savingsOnTrackRatio = 0.8;

/**
 * Rang der Signalarten untereinander.
 *
 * Der Leitgedanke: Was zurückliegt, steht vor dem, was ansteht; was ansteht,
 * vor dem, was nur ein Hinweis ist. Eine überfällige Aufgabe ist heute
 * einlösbar, ein überschrittenes Budget ordnet die Ausgaben des Tages ein,
 * eine Frist liegt in der Zukunft, die Tagesplanung ist eine Planungshilfe,
 * und die Reflexion ist ein Angebot.
 *
 * Innerhalb einer Art entscheidet die Dringlichkeit: ein überschrittenes
 * Budget vor einer 80-Prozent-Meldung, eine Frist in drei Tagen vor einer in
 * dreißig.
 */
const signalRank: Record<TodaySignalKind, number> = {
  overdue: 5,
  budget: 4,
  savings: 3,
  capacity: 2,
  reflection: 1,
};

type RankedSignal = TodaySignal & { urgency: number };

/**
 * Die Signale des Tages, absteigend nach Dringlichkeit und hart auf drei
 * begrenzt. Trifft nichts zu, ist das Ergebnis leer — und genau das ist die
 * Aussage: alles im Rahmen.
 *
 * Die Funktion liest ausschließlich und verändert keine Quelle.
 */
export function buildTodaySignals(
  input: TodaySignalInput,
  context: TodayContext,
): TodaySignal[] {
  const ranked = [
    ...buildOverdueSignal(input.overview),
    ...buildBudgetSignal(input, context),
    ...buildSavingsSignal(input, context),
    ...buildCapacitySignal(input.overview),
    ...buildReflectionSignal(input.overview),
  ];

  return ranked
    .sort(
      (left, right) =>
        signalRank[right.kind] - signalRank[left.kind] ||
        right.urgency - left.urgency,
    )
    .slice(0, maximumSignals)
    .map((signal) => ({
      id: signal.id,
      kind: signal.kind,
      text: signal.text,
      tone: signal.tone,
    }));
}

function buildOverdueSignal(overview: TodayOverview): RankedSignal[] {
  if (overview.overdueTaskCount === 0) return [];

  return [
    {
      id: "signal-overdue",
      kind: "overdue",
      text:
        overview.overdueTaskCount === 1
          ? "1 Aufgabe aus den Vortagen"
          : `${overview.overdueTaskCount} Aufgaben aus den Vortagen`,
      tone: "attention",
      urgency: overview.overdueTaskCount,
    },
  ];
}

/**
 * Nur die am weitesten fortgeschrittene Kategorie bekommt eine Zeile. Sind
 * mehrere betroffen, nennt der Text ihre Zahl — verschwiegen wird nichts, aber
 * die Ebene bleibt eine Übersicht.
 */
function buildBudgetSignal(
  input: TodaySignalInput,
  context: TodayContext,
): RankedSignal[] {
  const month = monthOfDay(context.today);
  const relevant = input.budgets.filter(
    (budget) => budget.archivedAt === undefined && budget.month === month,
  );
  if (relevant.length === 0) return [];

  const affected = relevant
    .map((budget) => calculateBudgetUsage(budget, input.transactions))
    .filter((usage) => usage.ratio !== null && usage.ratio >= budgetNoticeRatio)
    .sort((left, right) => (right.ratio ?? 0) - (left.ratio ?? 0));

  const leading = affected[0];
  if (leading === undefined) return [];

  const name =
    input.categories.find((category) => category.id === leading.categoryId)
      ?.name ?? "Entfernte Kategorie";
  const dayOfMonth = Number(context.today.slice(8, 10));
  const others =
    affected.length > 1
      ? ` · ${affected.length - 1} weitere ${
          affected.length - 1 === 1 ? "Kategorie" : "Kategorien"
        } über ${Math.round(budgetNoticeRatio * 100)} %`
      : "";

  return [
    {
      id: "signal-budget",
      kind: "budget",
      text:
        leading.state === "within"
          ? `${name}: ${Math.round((leading.ratio ?? 0) * 100)} % des Monatsbudgets nach ${dayOfMonth} ${dayOfMonth === 1 ? "Tag" : "Tagen"}${others}`
          : `${name}: Monatsbudget ${leading.state === "exceeded" ? "überschritten" : "erreicht"} nach ${dayOfMonth} ${dayOfMonth === 1 ? "Tag" : "Tagen"}${others}`,
      tone: "attention",
      urgency: leading.ratio ?? 0,
    },
  ];
}

/**
 * Eine Frist meldet sich erst, wenn sie näher rückt **und** der Fortschritt
 * zurückliegt. Ein Ziel, das vor der Frist steht, braucht keine Zeile.
 */
function buildSavingsSignal(
  input: TodaySignalInput,
  context: TodayContext,
): RankedSignal[] {
  const candidates = input.savingsGoals
    .flatMap((goal) => {
      // Ohne Frist gibt es nichts zu melden; der Umweg über `flatMap` spart
      // eine Typzusicherung, die `filter` hier nicht leisten kann.
      if (
        goal.archivedAt !== undefined ||
        goal.status !== "active" ||
        goal.targetDate === undefined
      ) {
        return [];
      }
      return [
        {
          daysLeft: differenceInCalendarDays(context.today, goal.targetDate),
          goal,
          progress: calculateSavingsProgress(goal, input.contributions),
        },
      ];
    })
    .filter(
      ({ daysLeft, progress }) =>
        daysLeft >= 0 &&
        daysLeft <= savingsDeadlineDays &&
        progress.ratio !== null &&
        progress.ratio < savingsOnTrackRatio,
    )
    .sort((left, right) => left.daysLeft - right.daysLeft);

  const leading = candidates[0];
  if (leading === undefined) return [];

  return [
    {
      id: "signal-savings",
      kind: "savings",
      text: `${leading.goal.name}: Frist ${describeDaysLeft(leading.daysLeft)}, ${Math.round((leading.progress.ratio ?? 0) * 100)} % erreicht`,
      tone: "attention",
      // Je näher die Frist, desto dringlicher.
      urgency: savingsDeadlineDays - leading.daysLeft,
    },
  ];
}

/**
 * Die Tagesplanung meldet sich nur, wenn sie über dem gesetzten Budget liegt.
 * Ein Tag im Rahmen braucht keine Zeile — das ist der Sinn der Ebene.
 */
function buildCapacitySignal(overview: TodayOverview): RankedSignal[] {
  const capacity = overview.capacity;
  if (capacity === undefined || !capacity.isOverBudget) return [];

  return [
    {
      id: "signal-capacity",
      kind: "capacity",
      text: `Heute geplant: ${formatMinutes(capacity.totalMinutes)}`,
      tone: "info",
      urgency: capacity.totalMinutes,
    },
  ];
}

function buildReflectionSignal(overview: TodayOverview): RankedSignal[] {
  if (!overview.journal.showEveningHint) return [];

  return [
    {
      id: "signal-reflection",
      kind: "reflection",
      text: "Der Abend ist ein guter Moment für die Reflexion",
      tone: "info",
      urgency: 0,
    },
  ];
}

function describeDaysLeft(days: number): string {
  if (days === 0) return "ist heute";
  if (days === 1) return "in 1 Tag";
  return `in ${days} Tagen`;
}

/** „90 Min." bis unter einer Stunde, darüber „1 h 30 min". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Restbudget des Monats über alle gesetzten Budgets, als fertiger Text. */
export function describeRemainingBudget(
  input: Pick<TodaySignalInput, "budgets" | "transactions">,
  context: TodayContext,
): { context: string; value: string } | undefined {
  const month = monthOfDay(context.today);
  const relevant = input.budgets.filter(
    (budget) => budget.archivedAt === undefined && budget.month === month,
  );
  if (relevant.length === 0) return undefined;

  const usages = relevant.map((budget) =>
    calculateBudgetUsage(budget, input.transactions),
  );
  const currency = usages[0]?.currency ?? "EUR";
  const remainingMinor = usages.reduce(
    (total, usage) => total + usage.remainingMinor,
    0,
  );
  const limitMinor = usages.reduce(
    (total, usage) => total + usage.limitMinor,
    0,
  );

  return {
    context: `Grundlage: ${relevant.length} ${relevant.length === 1 ? "gesetztes Budget" : "gesetzte Budgets"} über ${formatMoney(createMoney(limitMinor, currency))}`,
    // Eine Überschreitung ist ein gültiger Zustand und wird als negativer
    // Betrag benannt, nicht auf null gekappt.
    value: formatSignedMinorUnits(remainingMinor, currency),
  };
}
