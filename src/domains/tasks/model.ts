import { z } from "zod";

import { taskSchema } from "../../db/schemas/domain-records";
import {
  calendarDaySchema,
  isoInstantSchema,
} from "../../lib/dates/date-values";
import { entityIdSchema } from "../../lib/identifiers/entity-id";

export { taskSchema };
export type Task = z.infer<typeof taskSchema>;
export type TaskPriority = Task["priority"];
export type TaskStatus = Task["status"];

export const taskPriorityLabels: Record<TaskPriority, string> = {
  high: "Hoch",
  normal: "Normal",
  low: "Niedrig",
};

export const taskCategories = [
  { id: "00000000-0000-4000-8000-000000000901", label: "Privat" },
  { id: "00000000-0000-4000-8000-000000000902", label: "Arbeit" },
  { id: "00000000-0000-4000-8000-000000000903", label: "Erledigungen" },
] as const;

const taskCategoryIds = new Set<string>(
  taskCategories.map((category) => category.id),
);

export const taskDetailsSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    notes: z.string().trim().max(50_000).optional(),
    priority: z.enum(["low", "normal", "high"]),
    dueAt: isoInstantSchema.optional(),
    plannedDate: calendarDaySchema.optional(),
    estimatedMinutes: z.int().positive().max(100_000).optional(),
    categoryId: entityIdSchema.optional(),
    /** Optionale Zielreferenz; schnelle Erfassung bleibt ohne sie möglich. */
    goalId: entityIdSchema.optional(),
  })
  .strict()
  .superRefine((details, context) => {
    if (details.categoryId && !taskCategoryIds.has(details.categoryId)) {
      context.addIssue({
        code: "custom",
        message: "unknown task category",
        path: ["categoryId"],
      });
    }
  });

export type TaskDetails = z.infer<typeof taskDetailsSchema>;

export function getTaskCategoryLabel(categoryId: string | undefined) {
  return taskCategories.find((category) => category.id === categoryId)?.label;
}
