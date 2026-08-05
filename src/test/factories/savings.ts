import type {
  SavingsContribution,
  SavingsGoal,
} from "../../domains/finance/model";
import { sortContributions } from "../../domains/finance/savings";
import type { SavingsService } from "../../domains/finance/savings-service";

/**
 * Kleiner In-Memory-Ersatz für Komponententests. Die Persistenz selbst ist im
 * Repository- und Servicetest abgedeckt.
 */
export function createMemorySavingsService(): SavingsService {
  const goals: SavingsGoal[] = [];
  const contributions: SavingsContribution[] = [];
  let sequence = 0;

  const meta = () => ({
    createdAt: "2026-08-04T08:00:00.000Z",
    id: `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
    updatedAt: "2026-08-04T08:00:00.000Z",
  });

  const requireGoal = (id: string): SavingsGoal => {
    const goal = goals.find((row) => row.id === id);
    if (!goal) throw new Error("unknown savings goal");
    return goal;
  };

  const requireContribution = (id: string): SavingsContribution => {
    const contribution = contributions.find((row) => row.id === id);
    if (!contribution) throw new Error("unknown savings contribution");
    return contribution;
  };

  return {
    addContribution: async (details) => {
      const goal = requireGoal(details.savingsGoalId);
      if (goal.target.currency !== details.money.currency) {
        throw new Error("mixed currency");
      }
      const contribution = { ...meta(), ...details } as SavingsContribution;
      contributions.push(contribution);
      return contribution;
    },
    archiveGoal: async (id) => {
      const goal = requireGoal(id);
      goal.archivedAt = "2026-08-04T09:00:00.000Z";
      return goal;
    },
    changeStatus: async (id, status) => {
      const goal = requireGoal(id);
      goal.status = status;
      return goal;
    },
    countContributions: async (savingsGoalId) =>
      contributions.filter((row) => row.savingsGoalId === savingsGoalId).length,
    createGoal: async (details) => {
      const goal = { ...meta(), ...details } as SavingsGoal;
      goals.push(goal);
      return goal;
    },
    deleteGoalPermanently: async (id) => {
      const goal = requireGoal(id);
      const removed = contributions.filter((row) => row.savingsGoalId === id);
      for (const contribution of removed) {
        contributions.splice(contributions.indexOf(contribution), 1);
      }
      goals.splice(goals.indexOf(goal), 1);
      return { removedContributionCount: removed.length, savingsGoalId: id };
    },
    listContributions: async (savingsGoalId) =>
      sortContributions(
        contributions.filter(
          (row) =>
            row.archivedAt === undefined &&
            (savingsGoalId === undefined ||
              row.savingsGoalId === savingsGoalId),
        ),
      ),
    listGoals: async () => goals.filter((row) => row.archivedAt === undefined),
    removeContribution: async (id) => {
      const contribution = requireContribution(id);
      contribution.archivedAt = "2026-08-04T09:00:00.000Z";
      return contribution;
    },
    restoreContribution: async (id) => {
      const contribution = requireContribution(id);
      delete contribution.archivedAt;
      return contribution;
    },
    restoreGoal: async (id) => {
      const goal = requireGoal(id);
      delete goal.archivedAt;
      return goal;
    },
    updateContribution: async (id, patch) => {
      const contribution = requireContribution(id);
      const goal = requireGoal(contribution.savingsGoalId);
      if (patch.money && goal.target.currency !== patch.money.currency) {
        throw new Error("mixed currency");
      }
      Object.assign(contribution, patch);
      return contribution;
    },
    updateGoal: async (id, details) => {
      const goal = requireGoal(id);
      Object.assign(goal, details);
      return goal;
    },
  };
}
