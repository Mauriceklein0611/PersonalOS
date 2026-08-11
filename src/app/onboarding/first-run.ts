export type FirstRunProgressInput = {
  financeCategoryCount: number;
  habitCount: number;
  taskCount: number;
};

export type FirstRunProgress = {
  financeCategoryCreated: boolean;
  habitCreated: boolean;
  requiredComplete: boolean;
  requiredDone: number;
  taskCreated: boolean;
};

/**
 * Leitet den Einrichtungsstand ausschließlich aus bestehenden Datensätzen ab.
 * Eine eigene Liste erledigter Schritte wäre eine zweite, widersprüchliche
 * Wahrheit und könnte nach Import oder Löschung veralten.
 */
export function deriveFirstRunProgress({
  financeCategoryCount,
  habitCount,
  taskCount,
}: FirstRunProgressInput): FirstRunProgress {
  const taskCreated = taskCount > 0;
  const habitCreated = habitCount > 0;

  return {
    financeCategoryCreated: financeCategoryCount > 0,
    habitCreated,
    requiredComplete: taskCreated && habitCreated,
    requiredDone: Number(taskCreated) + Number(habitCreated),
    taskCreated,
  };
}
