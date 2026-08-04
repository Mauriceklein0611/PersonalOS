import { z } from "zod";

import {
  habitDetailsSchema,
  habitEntryDetailsSchema,
  habitEntrySchema,
  habitScheduleSchema,
  habitSchema,
} from "../../db/schemas/domain-records";

export {
  habitDetailsSchema,
  habitEntryDetailsSchema,
  habitEntrySchema,
  habitScheduleSchema,
  habitSchema,
};

export type Habit = z.infer<typeof habitSchema>;
export type HabitDetails = z.infer<typeof habitDetailsSchema>;
export type HabitEntry = z.infer<typeof habitEntrySchema>;
export type HabitEntryDetails = z.infer<typeof habitEntryDetailsSchema>;
export type HabitEntryStatus = HabitEntry["status"];
export type HabitSchedule = z.infer<typeof habitScheduleSchema>;
