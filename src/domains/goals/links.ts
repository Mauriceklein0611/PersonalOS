import type { Habit } from "../habits/model";
import type { Task } from "../tasks/model";
import type { Goal } from "./model";

/**
 * Verknüpfungen sind opt-in. Diese Auswertung liest ausschließlich und
 * verändert keine Quelldaten; sie importiert keine UI einer anderen Domain.
 */
export type GoalLinkSummary = {
  goalId: string;
  openTaskCount: number;
  completedTaskCount: number;
  taskTitles: string[];
  activeHabitCount: number;
  habitNames: string[];
};

const maximumNames = 5;

export function summarizeGoalLinks(
  goal: Goal,
  tasks: readonly Task[],
  habits: readonly Habit[],
): GoalLinkSummary {
  const linkedTasks = tasks.filter(
    (task) => task.goalId === goal.id && task.archivedAt === undefined,
  );
  const linkedHabits = habits.filter(
    (habit) => habit.goalId === goal.id && habit.archivedAt === undefined,
  );

  return {
    activeHabitCount: linkedHabits.length,
    completedTaskCount: linkedTasks.filter(
      (task) => task.status === "completed",
    ).length,
    goalId: goal.id,
    habitNames: linkedHabits.slice(0, maximumNames).map((habit) => habit.name),
    openTaskCount: linkedTasks.filter((task) => task.status === "open").length,
    taskTitles: linkedTasks.slice(0, maximumNames).map((task) => task.title),
  };
}

/** Beschreibt die Verknüpfung sachlich, ohne Bewertung oder Zielvorgabe. */
export function describeGoalLinks(summary: GoalLinkSummary): string {
  const parts: string[] = [];
  const taskCount = summary.openTaskCount + summary.completedTaskCount;

  if (taskCount > 0) {
    parts.push(
      `${taskCount} ${taskCount === 1 ? "Aufgabe" : "Aufgaben"}, davon ${summary.completedTaskCount} erledigt`,
    );
  }
  if (summary.activeHabitCount > 0) {
    parts.push(
      `${summary.activeHabitCount} ${
        summary.activeHabitCount === 1 ? "Routine" : "Routinen"
      }`,
    );
  }

  return parts.length === 0
    ? "Noch nichts mit diesem Ziel verknüpft."
    : `Verknüpft: ${parts.join(" · ")}.`;
}

/**
 * Ein endgültiges Löschen muss die Referenzen mitnehmen. Diese Funktion sagt,
 * welche Datensätze dafür angefasst werden, damit die Oberfläche vor der
 * Bestätigung ehrlich benennen kann, was passiert.
 */
export function collectReferencingIds(
  goal: Goal,
  tasks: readonly Task[],
  habits: readonly Habit[],
): { habitIds: string[]; taskIds: string[] } {
  return {
    habitIds: habits
      .filter((habit) => habit.goalId === goal.id)
      .map((habit) => habit.id),
    taskIds: tasks
      .filter((task) => task.goalId === goal.id)
      .map((task) => task.id),
  };
}
