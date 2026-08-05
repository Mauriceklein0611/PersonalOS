import { personalOsDatabase, type PersonalOsDatabase } from "../../db/database";
import { runInTransaction } from "../../db/transactions";
import {
  personalOsHabitRepository,
  type HabitRepository,
} from "../habits/repository";
import {
  personalOsTaskRepository,
  type TaskRepository,
} from "../tasks/repository";
import {
  collectReferencingIds,
  summarizeGoalLinks,
  type GoalLinkSummary,
} from "./links";
import type { Goal } from "./model";
import {
  personalOsGoalMilestoneRepository,
  personalOsGoalRepository,
  type GoalMilestoneRepository,
  type GoalRepository,
} from "./repository";

export type GoalDeletionResult = {
  clearedHabitCount: number;
  clearedTaskCount: number;
  removedMilestoneCount: number;
};

/**
 * Bündelt die domänenübergreifenden Zugriffe an genau einer Stelle. Lesen ist
 * eine reine Auswertung; die einzige Änderung ist das endgültige Löschen, das
 * Referenzen in derselben Transaktion auflöst.
 */
export type GoalOption = { id: string; title: string };

export interface GoalLinkService {
  countReferences(goal: Goal): Promise<{ habits: number; tasks: number }>;
  deleteGoalPermanently(goal: Goal): Promise<GoalDeletionResult>;
  /** Auswahlliste für andere Domains, ohne deren UI zu kennen. */
  listGoalOptions(): Promise<GoalOption[]>;
  summarize(goal: Goal): Promise<GoalLinkSummary>;
}

export function createGoalLinkService(
  dependencies: {
    database?: PersonalOsDatabase;
    goals?: GoalRepository;
    habits?: HabitRepository;
    milestones?: GoalMilestoneRepository;
    tasks?: TaskRepository;
  } = {},
): GoalLinkService {
  const database = dependencies.database ?? personalOsDatabase;
  const goals = dependencies.goals ?? personalOsGoalRepository;
  const habits = dependencies.habits ?? personalOsHabitRepository;
  const milestones =
    dependencies.milestones ?? personalOsGoalMilestoneRepository;
  const tasks = dependencies.tasks ?? personalOsTaskRepository;

  const readReferences = async (goal: Goal) => {
    const [allTasks, allHabits] = await Promise.all([
      tasks.list({ includeArchived: true }),
      habits.list({ includeArchived: true }),
    ]);
    return collectReferencingIds(goal, allTasks, allHabits);
  };

  return {
    async countReferences(goal) {
      const { habitIds, taskIds } = await readReferences(goal);
      return { habits: habitIds.length, tasks: taskIds.length };
    },
    async deleteGoalPermanently(goal) {
      const { habitIds, taskIds } = await readReferences(goal);
      const linkedMilestones = await milestones.listForGoal(goal.id);

      return runInTransaction(
        database,
        ["goals", "goalMilestones", "tasks", "habits"],
        async () => {
          // Aufgaben und Gewohnheiten bleiben erhalten; nur die Referenz geht.
          for (const taskId of taskIds) {
            await tasks.update(taskId, { goalId: undefined });
          }
          for (const habitId of habitIds) {
            await habits.update(habitId, { goalId: undefined });
          }
          for (const milestone of linkedMilestones) {
            await milestones.deletePermanently(milestone.id);
          }
          await goals.deletePermanently(goal.id);

          return {
            clearedHabitCount: habitIds.length,
            clearedTaskCount: taskIds.length,
            removedMilestoneCount: linkedMilestones.length,
          };
        },
      );
    },
    async listGoalOptions() {
      const stored = await goals.list();
      return stored
        .filter((goal) => goal.status === "active" || goal.status === "paused")
        .map((goal) => ({ id: goal.id, title: goal.title }));
    },
    async summarize(goal) {
      const [allTasks, allHabits] = await Promise.all([
        tasks.list(),
        habits.list(),
      ]);
      return summarizeGoalLinks(goal, allTasks, allHabits);
    },
  };
}

export const personalOsGoalLinkService = createGoalLinkService();
