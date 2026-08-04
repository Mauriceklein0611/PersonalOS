export const personalOsSchemaVersion = 2;

export const personalOsTableNames = [
  "settings",
  "tasks",
  "habits",
  "habitEntries",
  "journalEntries",
  "goals",
  "goalMilestones",
  "financeCategories",
  "transactions",
  "monthlyBudgets",
  "savingsGoals",
  "savingsContributions",
  "scoreSettings",
  "scoreSnapshots",
] as const;

export type PersonalOsTableName = (typeof personalOsTableNames)[number];

export const personalOsSchemaV1 = {
  settings: "id, updatedAt",
  tasks:
    "id, status, plannedDate, dueAt, categoryId, goalId, archivedAt, updatedAt",
  habits: "id, startDate, endDate, categoryId, goalId, archivedAt, updatedAt",
  habitEntries:
    "id, &[habitId+localDate], habitId, localDate, status, archivedAt, updatedAt",
  journalEntries: "id, &localDate, archivedAt, updatedAt",
  goals: "id, status, targetDate, archivedAt, updatedAt",
  goalMilestones: "id, goalId, &[goalId+order], status, archivedAt, updatedAt",
  financeCategories: "id, kind, archivedAt, updatedAt",
  transactions:
    "id, kind, bookedOn, categoryId, money.currency, archivedAt, updatedAt",
  monthlyBudgets:
    "id, &[month+categoryId], month, categoryId, limit.currency, archivedAt, updatedAt",
  savingsGoals: "id, status, target.currency, archivedAt, updatedAt",
  savingsContributions:
    "id, savingsGoalId, bookedOn, money.currency, archivedAt, updatedAt",
  scoreSettings: "id, updatedAt",
  scoreSnapshots:
    "id, &[localDate+engineVersion], localDate, engineVersion, archivedAt, updatedAt",
} satisfies Record<PersonalOsTableName, string>;

export const personalOsSchemaV2 = {
  ...personalOsSchemaV1,
} satisfies Record<PersonalOsTableName, string>;
