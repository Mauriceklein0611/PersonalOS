import { personalOsTableNames } from "../schema";
import type { BackupData } from "../schemas/domain-records";

export class BackupIntegrityError extends Error {
  constructor(options?: ErrorOptions) {
    super(
      "Das Backup enthält widersprüchliche Datensätze oder Referenzen.",
      options,
    );
    this.name = "BackupIntegrityError";
  }
}

export function assertBackupIntegrity(data: BackupData): void {
  for (const tableName of personalOsTableNames) {
    assertUnique(data[tableName].map((record) => record.id));
  }

  assertUnique(
    data.habitEntries.map((entry) => `${entry.habitId}:${entry.localDate}`),
  );
  assertUnique(data.journalEntries.map((entry) => entry.localDate));
  assertUnique(
    data.goalMilestones.map((item) => `${item.goalId}:${item.order}`),
  );
  assertUnique(
    data.monthlyBudgets.map((item) => `${item.month}:${item.categoryId}`),
  );
  assertUnique(
    data.scoreSnapshots.map(
      (item) => `${item.localDate}:${item.engineVersion}`,
    ),
  );

  const habitIds = new Set(data.habits.map((record) => record.id));
  const goalIds = new Set(data.goals.map((record) => record.id));
  const categoryIds = new Set(
    data.financeCategories.map((record) => record.id),
  );
  const savingsGoalIds = new Set(data.savingsGoals.map((record) => record.id));

  assertReferences(
    data.habitEntries.map((record) => record.habitId),
    habitIds,
  );
  assertReferences(
    data.goalMilestones.map((record) => record.goalId),
    goalIds,
  );
  assertReferences(
    data.tasks.flatMap((record) => (record.goalId ? [record.goalId] : [])),
    goalIds,
  );
  assertReferences(
    data.habits.flatMap((record) => (record.goalId ? [record.goalId] : [])),
    goalIds,
  );
  assertReferences(
    data.transactions.map((record) => record.categoryId),
    categoryIds,
  );
  assertReferences(
    data.monthlyBudgets.map((record) => record.categoryId),
    categoryIds,
  );
  assertReferences(
    data.savingsContributions.map((record) => record.savingsGoalId),
    savingsGoalIds,
  );
}

function assertUnique(values: string[]): void {
  if (new Set(values).size !== values.length) {
    throw new BackupIntegrityError();
  }
}

function assertReferences(
  values: string[],
  targets: ReadonlySet<string>,
): void {
  if (values.some((value) => !targets.has(value))) {
    throw new BackupIntegrityError();
  }
}
