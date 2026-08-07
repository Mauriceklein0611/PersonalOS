export const personalOsSchemaVersion = 5;

/**
 * Die Tabellen der Versionen 1 bis 3. Sie stehen getrennt, damit eine neue
 * Tabelle nicht rückwirkend in einer alten Schemaversion auftaucht.
 */
export const personalOsTableNamesV1 = [
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

export const personalOsTableNames = [
  ...personalOsTableNamesV1,
  "hiddenInsights",
] as const;

export type PersonalOsTableNameV1 = (typeof personalOsTableNamesV1)[number];
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
} satisfies Record<PersonalOsTableNameV1, string>;

export const personalOsSchemaV2 = {
  ...personalOsSchemaV1,
} satisfies Record<PersonalOsTableNameV1, string>;

export const personalOsSchemaV3 = {
  ...personalOsSchemaV2,
} satisfies Record<PersonalOsTableNameV1, string>;

/**
 * `insightId` ist eindeutig: Derselbe Insight kann nicht zweimal ausgeblendet
 * sein. `ruleId` bleibt indiziert, damit ein späteres Stummschalten je Regel
 * ohne Migration möglich ist.
 */
export const personalOsSchemaV4 = {
  ...personalOsSchemaV3,
  hiddenInsights: "id, &insightId, ruleId, archivedAt, updatedAt",
} satisfies Record<PersonalOsTableName, string>;

/**
 * `sourceTransactionId` ist eindeutig: Eine Ausgabe kann höchstens einen
 * Sparbeitrag belegen, sonst wäre derselbe Betrag mehrfach gebunden. Ein
 * Beitrag ohne Verknüpfung trägt den Schlüssel nicht und steht deshalb auch
 * nicht im Index.
 */
export const personalOsSchemaV5 = {
  ...personalOsSchemaV4,
  savingsContributions:
    "id, savingsGoalId, bookedOn, money.currency, &sourceTransactionId, archivedAt, updatedAt",
} satisfies Record<PersonalOsTableName, string>;
