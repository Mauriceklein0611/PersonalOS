import {
  personalOsFinanceService,
  type FinanceService,
} from "../finance/service";
import {
  personalOsSavingsService,
  type SavingsService,
} from "../finance/savings-service";
import { personalOsGoalService, type GoalService } from "../goals/service";
import { personalOsHabitService, type HabitService } from "../habits/service";
import {
  personalOsJournalService,
  type JournalService,
} from "../journal/service";
import { personalOsTaskService, type TaskService } from "../tasks/service";
import type { LifeScoreInput } from "./score-engine";
import type { ScorePeriod } from "./score-model";

/**
 * Der Score liest quer über alle Bereiche. Diese Stelle ist der einzige Ort,
 * an dem das passiert. Der Vertrag nennt ausschließlich Lesefunktionen — eine
 * schreibende Methode steht hier gar nicht zur Verfügung.
 */
export type ScoreSources = {
  finance: Pick<FinanceService, "listBudgets" | "listTransactions">;
  goals: Pick<GoalService, "list" | "listMilestones">;
  habits: Pick<HabitService, "list" | "listEntries">;
  journal: Pick<JournalService, "list">;
  savings: Pick<SavingsService, "listContributions" | "listGoals">;
  tasks: Pick<TaskService, "list">;
};

export const personalOsScoreSources: ScoreSources = {
  finance: personalOsFinanceService,
  goals: personalOsGoalService,
  habits: personalOsHabitService,
  journal: personalOsJournalService,
  savings: personalOsSavingsService,
  tasks: personalOsTaskService,
};

export type ScoreInputRanges = {
  /** Sieben-Tage-Fenster für Fokus, Gewohnheiten, Wohlbefinden und Ziele. */
  period: ScorePeriod;
  /** Kalendermonat der Finanzkomponente, als `YYYY-MM`. */
  month: string;
};

export async function readLifeScoreInput(
  sources: ScoreSources,
  ranges: ScoreInputRanges,
): Promise<LifeScoreInput> {
  const [tasks, habits, journalEntries, goals, budgets, savingsGoals] =
    await Promise.all([
      sources.tasks.list(),
      sources.habits.list(),
      // Das Fenster reicht, weil Wohlbefinden nur die Tage darin bewertet.
      sources.journal.list({ from: ranges.period.from, to: ranges.period.to }),
      sources.goals.list(),
      sources.finance.listBudgets(ranges.month),
      sources.savings.listGoals(),
    ]);

  const [habitEntries, milestones, transactions, contributions] =
    await Promise.all([
      collect(
        habits.map((habit) =>
          sources.habits.listEntries(habit.id, {
            from: ranges.period.from,
            to: ranges.period.to,
          }),
        ),
      ),
      collect(goals.map((goal) => sources.goals.listMilestones(goal.id))),
      sources.finance.listTransactions({ month: ranges.month }),
      sources.savings.listContributions(),
    ]);

  return {
    budgets,
    contributions,
    goals,
    habitEntries,
    habits,
    journalEntries,
    milestones,
    savingsGoals,
    tasks,
    transactions,
  };
}

async function collect<TValue>(
  requests: readonly Promise<TValue[]>[],
): Promise<TValue[]> {
  return (await Promise.all(requests)).flat();
}
