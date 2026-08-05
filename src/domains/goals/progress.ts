import type { CalendarDay } from "../../lib/dates/date-values";
import type { Goal, GoalMilestone, GoalStatus } from "./model";

export type GoalProgress = {
  /** Anteil zwischen 0 und 1, oder `null`, wenn es keine Grundlage gibt. */
  ratio: number | null;
  completedCount: number;
  totalCount: number;
  /** Erklärt, worauf der Wert beruht. Nie eine Bewertung. */
  basis: string;
};

/**
 * Der Fortschritt wird immer neu berechnet und nie gespeichert. Archivierte
 * Meilensteine zählen weder im Zähler noch im Nenner, damit ein Aufräumen
 * die Quote nicht rückwirkend verschlechtert.
 */
export function calculateGoalProgress(
  goal: Goal,
  milestones: readonly GoalMilestone[],
): GoalProgress {
  if (goal.progressMode === "manual") {
    const ratio =
      goal.manualProgress === undefined
        ? null
        : clamp(goal.manualProgress) / 100;
    return {
      basis:
        goal.manualProgress === undefined
          ? "Noch kein manueller Wert erfasst."
          : "Manuell erfasster Wert.",
      completedCount: 0,
      ratio,
      totalCount: 0,
    };
  }

  const active = milestones.filter(
    (milestone) =>
      milestone.goalId === goal.id && milestone.archivedAt === undefined,
  );
  const completedCount = active.filter(
    (milestone) => milestone.status === "completed",
  ).length;

  if (active.length === 0) {
    return {
      basis: "Noch kein Meilenstein angelegt.",
      completedCount: 0,
      ratio: null,
      totalCount: 0,
    };
  }

  return {
    basis: `${completedCount} von ${active.length} Meilensteinen abgeschlossen.`,
    completedCount,
    ratio: completedCount / active.length,
    totalCount: active.length,
  };
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 100);
}

/** Meilensteine erscheinen in ihrer festgelegten Reihenfolge, dann nach Titel. */
export function sortMilestones(
  milestones: readonly GoalMilestone[],
): GoalMilestone[] {
  return [...milestones].sort((first, second) => {
    if (first.order !== second.order) return first.order - second.order;
    return first.title.localeCompare(second.title, "de-DE");
  });
}

export function nextMilestoneOrder(
  milestones: readonly GoalMilestone[],
): number {
  return milestones.reduce(
    (highest, milestone) => Math.max(highest, milestone.order + 1),
    0,
  );
}

const allowedTransitions: Record<GoalStatus, readonly GoalStatus[]> = {
  active: ["paused", "completed", "cancelled"],
  cancelled: ["active"],
  completed: ["active"],
  paused: ["active", "completed", "cancelled"],
};

/**
 * Ein abgeschlossenes oder abgebrochenes Ziel wird zuerst wieder aktiviert.
 * Das verhindert stille Sprünge zwischen Endzuständen.
 */
export function canChangeGoalStatus(from: GoalStatus, to: GoalStatus): boolean {
  if (from === to) return true;
  return allowedTransitions[from].includes(to);
}

export type DeadlineState = "none" | "upcoming" | "today" | "passed";

/**
 * Beschreibt die Frist sachlich. Eine verstrichene Frist ist ein Hinweis,
 * kein Versäumnis, und erzeugt deshalb keine Dringlichkeitssprache.
 */
export function describeDeadline(
  goal: Goal,
  today: CalendarDay,
): { state: DeadlineState; text: string } {
  if (goal.targetDate === undefined) {
    return { state: "none", text: "Ohne Zieldatum" };
  }
  if (goal.status === "completed") {
    return { state: "none", text: `Zieldatum war ${goal.targetDate}` };
  }
  if (goal.targetDate === today) {
    return { state: "today", text: "Zieldatum ist heute" };
  }
  if (goal.targetDate < today) {
    return { state: "passed", text: "Zieldatum liegt zurück" };
  }
  return { state: "upcoming", text: `Zieldatum ${goal.targetDate}` };
}
