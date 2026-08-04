import type { Transaction } from "dexie";
import { z } from "zod";

import { calendarDaySchema } from "../../lib/dates/date-values";
import { entityIdSchema } from "../../lib/identifiers/entity-id";
import { habitSchema } from "../schemas/domain-records";
import { entityMetaSchema } from "../types";

const legacyHabitSchema = entityMetaSchema.safeExtend({
  name: z.string().min(1).max(500),
  description: z.string().max(50_000).optional(),
  schedule: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("daily") }).strict(),
    z
      .object({
        kind: z.literal("weekdays"),
        days: z.array(z.int().min(1).max(7)).min(1).max(7),
      })
      .strict(),
    z
      .object({
        kind: z.literal("timesPerWeek"),
        count: z.int().min(1).max(7),
      })
      .strict(),
  ]),
  startDate: calendarDaySchema,
  endDate: calendarDaySchema.optional(),
  categoryId: entityIdSchema.optional(),
  goalId: entityIdSchema.optional(),
  color: z.string().max(100).optional(),
});

export function migrateHabitRecordToV3(value: unknown) {
  const legacy = legacyHabitSchema.parse(value);
  const schedule =
    legacy.schedule.kind === "weekdays"
      ? {
          ...legacy.schedule,
          days: [...new Set(legacy.schedule.days)].sort(
            (left, right) => left - right,
          ),
        }
      : legacy.schedule;
  const migrated = { ...legacy, schedule };
  if (migrated.endDate !== undefined && migrated.endDate < migrated.startDate) {
    const withoutEndDate = { ...migrated };
    delete withoutEndDate.endDate;
    return habitSchema.parse(withoutEndDate);
  }
  return habitSchema.parse(migrated);
}

export async function migrateToVersion3(
  transaction: Transaction,
): Promise<void> {
  await transaction
    .table<unknown, string>("habits")
    .toCollection()
    .modify((habit, context) => {
      context.value = migrateHabitRecordToV3(habit);
    });
}
