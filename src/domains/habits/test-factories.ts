import type { Habit, HabitEntry } from "./model";

export const habitId = "00000000-0000-4000-8000-000000001001";
export const baseInstant = "2026-08-03T08:00:00.000Z";

export function createHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: habitId,
    createdAt: baseInstant,
    updatedAt: baseInstant,
    name: "Synthetische Gewohnheit",
    schedule: { kind: "daily" },
    startDate: "2026-08-03",
    ...overrides,
  };
}

export function createHabitEntry(
  localDate: string,
  status: HabitEntry["status"] = "done",
  overrides: Partial<HabitEntry> = {},
): HabitEntry {
  return {
    id: `00000000-0000-4000-8000-${localDate.replaceAll("-", "").padStart(12, "0")}`,
    createdAt: baseInstant,
    updatedAt: baseInstant,
    habitId,
    localDate,
    status,
    ...overrides,
  };
}
