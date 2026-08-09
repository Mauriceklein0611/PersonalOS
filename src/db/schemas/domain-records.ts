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

const goalFields = {
  title: shortText,
  description: longText.optional(),
  status: z.enum(["active", "paused", "completed", "cancelled"]),
  targetDate: calendarDaySchema.optional(),
  progressMode: z.enum(["milestones", "manual"]),
  manualProgress: z.number().min(0).max(100).optional(),
  completedAt: isoInstantSchema.optional(),
};

/**
 * `completedAt` existiert genau dann, wenn der Status `completed` ist. Ein
 * manueller Fortschritt gehört nur zum manuellen Modus, damit beim Wechsel
 * kein alter Wert stehen bleibt.
 */
const checkGoalConsistency = (
  goal: {
    completedAt?: string;
    manualProgress?: number;
    progressMode: "milestones" | "manual";
    status: string;
  },
  context: z.RefinementCtx,
) => {
  const shouldBeCompleted = goal.status === "completed";
  if (shouldBeCompleted !== (goal.completedAt !== undefined)) {
    context.addIssue({
      code: "custom",
      message: "completedAt must match completed status",
      path: ["completedAt"],
    });
  }

  if (goal.progressMode !== "manual" && goal.manualProgress !== undefined) {
    context.addIssue({
      code: "custom",
      message: "manualProgress belongs to the manual progress mode",
      path: ["manualProgress"],
    });
  }
};

export const goalDetailsSchema = z
  .object(goalFields)
  .strict()
  .superRefine(checkGoalConsistency);

export const goalSchema = entityMetaSchema
  .safeExtend(goalFields)
  .superRefine(checkGoalConsistency);

const goalMilestoneFields = {
  goalId: entityIdSchema,
  title: shortText,
  targetDate: calendarDaySchema.optional(),
  status: z.enum(["open", "completed"]),
  completedAt: isoInstantSchema.optional(),
  order: z.int().nonnegative(),
};

const checkMilestoneConsistency = (
  milestone: { completedAt?: string; status: string },
  context: z.RefinementCtx,
) => {
  const shouldBeCompleted = milestone.status === "completed";
  if (shouldBeCompleted !== (milestone.completedAt !== undefined)) {
    context.addIssue({
      code: "custom",
      message: "completedAt must match completed status",
      path: ["completedAt"],
    });
  }
};

export const goalMilestoneDetailsSchema = z
  .object(goalMilestoneFields)
  .strict()
  .superRefine(checkMilestoneConsistency);

export const goalMilestoneSchema = entityMetaSchema
  .safeExtend(goalMilestoneFields)
  .superRefine(checkMilestoneConsistency);

const financeCategoryFields = {
  name: shortText,
  kind: z.enum(["income", "expense"]),
  color: z.string().max(100).optional(),
};

export const financeCategoryDetailsSchema = z
  .object(financeCategoryFields)
  .strict();

export const financeCategorySchema = entityMetaSchema.safeExtend(
  financeCategoryFields,
);

/**
 * Die Richtung steckt in `kind`. Der Betrag bleibt deshalb immer eine
 * nicht negative Zahl in Minor Units.
 */
const transactionFields = {
  kind: z.enum(["income", "expense"]),
  money: moneySchema,
  categoryId: entityIdSchema,
  bookedOn: calendarDaySchema,
  description: longText.optional(),
  /**
   * Gesetzt, wenn die Buchung aus einer bestätigten Vorlage entstanden ist.
   * Ihr Fehlen heißt „von Hand erfasst"; deshalb bleiben alle vor der Vorlage
   * geschriebenen Buchungen ohne Migration gültig. Siehe
   * [ADR 0013](../../../docs/decisions/0013-recurring-transactions-are-confirmed-templates.md).
   */
  recurringTransactionId: entityIdSchema.optional(),
};

/**
 * Eine Vorlage erzeugt von sich aus **nie** eine Buchung. Sie beschreibt nur,
 * was der Nutzer im Monat erwartet; erst seine Bestätigung schreibt einen
 * Datensatz. `dayOfMonth` ist auf 28 begrenzt, weil jeder Monat einen 28. hat
 * und jede Ausweichregel für den 31. eine stille Annahme wäre.
 */
const recurringTransactionFields = {
  kind: z.enum(["income", "expense"]),
  money: moneySchema,
  categoryId: entityIdSchema,
  dayOfMonth: z.int().min(1).max(28),
  description: longText.optional(),
  name: shortText,
};

export const recurringTransactionDetailsSchema = z
  .object(recurringTransactionFields)
  .strict();

export const recurringTransactionSchema = entityMetaSchema.safeExtend(
  recurringTransactionFields,
);

export const transactionDetailsSchema = z.object(transactionFields).strict();

export const transactionSchema = entityMetaSchema.safeExtend(transactionFields);

const monthlyBudgetFields = {
  month: calendarMonthSchema,
  categoryId: entityIdSchema,
  limit: moneySchema,
};

export const monthlyBudgetDetailsSchema = z
  .object(monthlyBudgetFields)
  .strict();

export const monthlyBudgetSchema =
  entityMetaSchema.safeExtend(monthlyBudgetFields);

const savingsGoalFields = {
  name: shortText,
  target: moneySchema,
  targetDate: calendarDaySchema.optional(),
  status: z.enum(["active", "completed", "cancelled"]),
};

export const savingsGoalDetailsSchema = z.object(savingsGoalFields).strict();

export const savingsGoalSchema = entityMetaSchema.safeExtend(savingsGoalFields);

/**
 * `sourceTransactionId` verweist auf die Ausgabe, die diesen Beitrag ausgelöst
 * hat. Sie ist dieselbe Bewegung aus Sicht des Sparziels, nicht eine zweite:
 * Der verknüpfte Betrag steckt bereits in den Ausgaben des Monats. Ohne
 * Verweis bleibt der Beitrag eine Bewegung, die der Zahlungsfluss nicht kennt.
 */
const savingsContributionFields = {
  savingsGoalId: entityIdSchema,
  money: moneySchema,
  bookedOn: calendarDaySchema,
  note: longText.optional(),
  sourceTransactionId: entityIdSchema.optional(),
};

export const savingsContributionDetailsSchema = z
  .object(savingsContributionFields)
  .strict();

export const savingsContributionSchema = entityMetaSchema.safeExtend(
  savingsContributionFields,
);

const scoreSettingsFields = {
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
};

export const scoreSettingsDetailsSchema = z
  .object(scoreSettingsFields)
  .strict();

export const scoreSettingsSchema =
  entityMetaSchema.safeExtend(scoreSettingsFields);

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

/**
 * Der einzige persistierte Teil eines Insights. Alles andere wird bei jedem
 * Aufruf neu gerechnet; siehe [ADR 0010](../../../docs/decisions/0010-deterministic-insights-v1.md).
 */
const hiddenInsightFields = {
  insightId: z.string().min(1).max(300),
  ruleId: z.string().min(1).max(100),
  hiddenAt: isoInstantSchema,
};

export const hiddenInsightDetailsSchema = z
  .object(hiddenInsightFields)
  .strict();

export const hiddenInsightSchema =
  entityMetaSchema.safeExtend(hiddenInsightFields);

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
    // Ein Export im Format 1 kennt die Tabelle noch nicht. Er bleibt gültig
    // und wird als „nichts ausgeblendet“ gelesen.
    hiddenInsights: z.array(hiddenInsightSchema).default([]),
    // Dieselbe Regel für die Vorlagen: Formate 1 bis 3 kennen sie nicht und
    // werden als „keine Vorlage angelegt“ gelesen.
    recurringTransactions: z.array(recurringTransactionSchema).default([]),
  })
  .strict();

export type BackupData = z.infer<typeof backupDataSchema>;
