import { PersistenceError } from "../../db/errors";
import type { ListOptions } from "../../db/repositories/contracts";
import type {
  Goal,
  GoalDetails,
  GoalMilestone,
  GoalMilestoneDetails,
  GoalStatus,
} from "./model";
import { canChangeGoalStatus, nextMilestoneOrder } from "./progress";
import {
  personalOsGoalMilestoneRepository,
  personalOsGoalRepository,
  type GoalMilestoneRepository,
  type GoalRepository,
} from "./repository";

export type GoalClock = () => string;

export interface GoalService {
  addMilestone(
    goalId: string,
    title: string,
    targetDate?: string,
  ): Promise<GoalMilestone>;
  archive(id: string): Promise<Goal>;
  changeStatus(id: string, status: GoalStatus): Promise<Goal>;
  create(details: GoalDetails): Promise<Goal>;
  list(options?: ListOptions): Promise<Goal[]>;
  listMilestones(goalId: string): Promise<GoalMilestone[]>;
  removeMilestone(id: string): Promise<GoalMilestone>;
  restore(id: string): Promise<Goal>;
  restoreMilestone(id: string): Promise<GoalMilestone>;
  setManualProgress(id: string, progress: number): Promise<Goal>;
  setMilestoneStatus(
    id: string,
    status: GoalMilestone["status"],
  ): Promise<GoalMilestone>;
  updateDetails(id: string, details: GoalDetails): Promise<Goal>;
}

export function createGoalService(
  goals: GoalRepository = personalOsGoalRepository,
  milestones: GoalMilestoneRepository = personalOsGoalMilestoneRepository,
  clock: GoalClock = () => new Date().toISOString(),
): GoalService {
  return {
    async addMilestone(goalId, title, targetDate) {
      const goal = await goals.require(goalId);
      const existing = await milestones.listForGoal(goal.id);
      const details: GoalMilestoneDetails = {
        goalId: goal.id,
        order: nextMilestoneOrder(existing),
        status: "open",
        title,
        ...(targetDate === undefined ? {} : { targetDate }),
      };
      return milestones.create(details);
    },
    archive: (id) => goals.archive(id),
    async changeStatus(id, status) {
      const goal = await goals.require(id);
      if (!canChangeGoalStatus(goal.status, status)) {
        throw new PersistenceError("validation");
      }

      // Abschluss und Zeitstempel wandern immer gemeinsam.
      if (status === "completed") {
        return goals.update(id, { completedAt: clock(), status });
      }
      return goals.update(id, { completedAt: undefined, status });
    },
    create: (details) => goals.create(details),
    list: (options) => goals.list(options),
    listMilestones: (goalId) => milestones.listForGoal(goalId),
    removeMilestone: (id) => milestones.archive(id),
    restore: (id) => goals.restore(id),
    restoreMilestone: (id) => milestones.restore(id),
    async setManualProgress(id, progress) {
      const goal = await goals.require(id);
      if (goal.progressMode !== "manual") {
        throw new PersistenceError("validation");
      }
      return goals.update(id, {
        manualProgress: Math.min(Math.max(progress, 0), 100),
      });
    },
    setMilestoneStatus(id, status) {
      return milestones.update(id, {
        completedAt: status === "completed" ? clock() : undefined,
        status,
      });
    },
    async updateDetails(id, details) {
      const goal = await goals.require(id);
      // Ein Wechsel auf Meilensteine entfernt den manuellen Wert, statt ihn
      // unsichtbar mitzuschleppen.
      const manualProgress =
        details.progressMode === "manual" ? details.manualProgress : undefined;
      return goals.update(id, {
        ...details,
        completedAt: goal.completedAt,
        manualProgress,
        status: goal.status,
      });
    },
  };
}

export const personalOsGoalService = createGoalService();
