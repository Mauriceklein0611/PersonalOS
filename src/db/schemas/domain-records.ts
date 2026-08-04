import { z } from "zod";

import {
  calendarDaySchema,
  calendarMonthSchema,
  isoInstantSchema,
} from "../../lib/dates/date-values";
import { entityIdSchema } from "../../lib/identifiers/entity-id";
import { moneySchema } from "../../lib/money/money";
import { entityMetaSchema } from "../types";
import { settingsSchema } from "./settings";

const shortText = z.string().min(1).max(500);
const longText = z.string().max(50_000);
const optionalEntityId = entityIdSchema.optional();

export const taskSchema = entityMetaSchema
  .safeExtend({
    title: shortText,
    notes: longText.optional(),
    status: z.enum(["open", "completed", "cancelled"]),
    priority: z.enum(["low", "normal", "high"]),
    dueAt: isoInstantSchema.optional(),
    plannedDate: calendarDaySchema.optional(),
    estimatedMinutes: z.int().positive().max(100_000).optional(),
    categoryId: optionalEntityId,
    goalId: optionalEntityId,
    completedAt: isoInstantSchema.optional(),
  })
  .superRefine((task, context) => {
    const completionMatchesStatus =
      task.status === "completed"
        ? task.completedAt !== undefined
        : task.completedAt === undefined;
    if (!completionMatchesStatus) {
      context.addIssue({
        code: "custom",
        message: "completedAt must match completed status",
        path: ["completedAt"],
      });
    }
  });

const weekdayValuesSchema = z
  .array(z.int().min(1).max(7))
  .min(1)
  .max(7)
  .refine((days) => new Set(days).size === days.length, {
    message: "weekday schedule must not contain duplicates",
  });

export const habitScheduleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("daily") }).strict(),
  z
    .object({
      kind: z.literal("weekdays"),
      days: weekdayValuesSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("timesPerWeek"),
      count: z.int().min(1).max(7),
    })
    .strict(),
]);

const habitFields = {
  name: shortText,
  description: longText.optional(),
  schedule: habitScheduleSchema,
  startDate: calendarDaySchema,
  endDate: calendarDaySchema.optional(),
  categoryId: optionalEntityId,
  goalId: optionalEntityId,
  color: z.string().max(100).optional(),
};

const hasValidHabitDateRange = (habit: {
  endDate?: string;
  startDate: string;
}) => habit.endDate === undefined || habit.endDate >= habit.startDate;

export const habitDetailsSchema = z
  .object(habitFields)
  .strict()
  .refine(hasValidHabitDateRange, {
    message: "endDate must not be earlier than startDate",
    path: ["endDate"],
  });

export const habitSchema = entityMetaSchema
  .safeExtend(habitFields)
  .refine(hasValidHabitDateRange, {
    message: "endDate must not be earlier than startDate",
    path: ["endDate"],
  });

export const habitEntryDetailsSchema = z
  .object({
    habitId: entityIdSchema,
    localDate: calendarDaySchema,
    status: z.enum(["done", "skipped"]),
    note: longText.optional(),
  })
  .strict();

export const habitEntrySchema = entityMetaSchema.safeExtend({
  habitId: entityIdSchema,
  localDate: calendarDaySchema,
  status: z.enum(["done", "skipped"]),
  note: longText.optional(),
});

export const journalEntrySchema = entityMetaSchema.safeExtend({
  localDate: calendarDaySchema,
  mood: z.int().min(1).max(5).optional(),
  energy: z.int().min(1).max(5).optional(),
  stress: z.int().min(1).max(5).optional(),
  productivity: z.int().min(1).max(5).optional(),
  highlight: longText.optional(),
  improvement: longText.optional(),
  gratitude: longText.optional(),
  body: longText.optional(),
});

export const goalSchema = entityMetaSchema.safeExtend({
  title: shortText,
  description: longText.optional(),
  status: z.enum(["active", "paused", "completed", "cancelled"]),
  targetDate: calendarDaySchema.optional(),
  progressMode: z.enum(["milestones", "manual"]),
  manualProgress: z.number().min(0).max(100).optional(),
  completedAt: isoInstantSchema.optional(),
});

export const goalMilestoneSchema = entityMetaSchema.safeExtend({
  goalId: entityIdSchema,
  title: shortText,
  targetDate: calendarDaySchema.optional(),
  status: z.enum(["open", "completed"]),
  completedAt: isoInstantSchema.optional(),
  order: z.int().nonnegative(),
});

export const financeCategorySchema = entityMetaSchema.safeExtend({
  name: shortText,
  kind: z.enum(["income", "expense"]),
  color: z.string().max(100).optional(),
});

export const transactionSchema = entityMetaSchema.safeExtend({
  kind: z.enum(["income", "expense"]),
  money: moneySchema,
  categoryId: entityIdSchema,
  bookedOn: calendarDaySchema,
  description: longText.optional(),
});

export const monthlyBudgetSchema = entityMetaSchema.safeExtend({
  month: calendarMonthSchema,
  categoryId: entityIdSchema,
  limit: moneySchema,
});

export const savingsGoalSchema = entityMetaSchema.safeExtend({
  name: shortText,
  target: moneySchema,
  targetDate: calendarDaySchema.optional(),
  status: z.enum(["active", "completed", "cancelled"]),
});

export const savingsContributionSchema = entityMetaSchema.safeExtend({
  savingsGoalId: entityIdSchema,
  money: moneySchema,
  bookedOn: calendarDaySchema,
  note: longText.optional(),
});

export const scoreSettingsSchema = entityMetaSchema.safeExtend({
  enabled: z.boolean(),
  components: z.array(
    z
      .object({
        key: z.enum(["focus", "habits", "wellbeing", "goals", "finance"]),
        enabled: z.boolean(),
        weight: z.number().nonnegative(),
      })
      .strict(),
  ),
});

export const scoreSnapshotSchema = entityMetaSchema.safeExtend({
  localDate: calendarDaySchema,
  engineVersion: z.string().min(1).max(100),
  total: z.number().min(0).max(100).optional(),
  completeness: z.number().min(0).max(1),
  components: z.array(
    z
      .object({
        key: z.string().min(1).max(100),
        value: z.number().min(0).max(100).optional(),
        weight: z.number().nonnegative(),
        sourceCount: z.int().nonnegative(),
      })
      .strict(),
  ),
});

export const backupDataSchema = z
  .object({
    settings: z.array(settingsSchema),
    tasks: z.array(taskSchema),
    habits: z.array(habitSchema),
    habitEntries: z.array(habitEntrySchema),
    journalEntries: z.array(journalEntrySchema),
    goals: z.array(goalSchema),
    goalMilestones: z.array(goalMilestoneSchema),
    financeCategories: z.array(financeCategorySchema),
    transactions: z.array(transactionSchema),
    monthlyBudgets: z.array(monthlyBudgetSchema),
    savingsGoals: z.array(savingsGoalSchema),
    savingsContributions: z.array(savingsContributionSchema),
    scoreSettings: z.array(scoreSettingsSchema),
    scoreSnapshots: z.array(scoreSnapshotSchema),
  })
  .strict();

export type BackupData = z.infer<typeof backupDataSchema>;
