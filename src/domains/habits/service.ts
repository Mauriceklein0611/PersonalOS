import { PersistenceError } from "../../db/errors";
import type { ListOptions } from "../../db/repositories/contracts";
import {
  calendarDaySchema,
  type CalendarDay,
} from "../../lib/dates/date-values";
import type {
  Habit,
  HabitDetails,
  HabitEntry,
  HabitEntryStatus,
} from "./model";
import {
  personalOsHabitEntryRepository,
  personalOsHabitRepository,
  type HabitEntryRepository,
  type HabitRepository,
} from "./repository";
import { isHabitEligibleOn } from "./schedule";

export interface HabitService {
  archive(id: string): Promise<Habit>;
  checkIn(
    habitId: string,
    localDate: CalendarDay,
    status: HabitEntryStatus,
    note?: string,
  ): Promise<HabitEntry>;
  create(details: HabitDetails): Promise<Habit>;
  list(options?: ListOptions): Promise<Habit[]>;
  listEntries(
    habitId: string,
    range?: { from?: CalendarDay; to?: CalendarDay },
  ): Promise<HabitEntry[]>;
  reopenCheckIn(habitId: string, localDate: CalendarDay): Promise<boolean>;
  restore(id: string): Promise<Habit>;
  updateDetails(id: string, details: HabitDetails): Promise<Habit>;
}

export function createHabitService(
  habits: HabitRepository,
  entries: HabitEntryRepository,
): HabitService {
  const normalizeDetails = (details: HabitDetails): HabitDetails => ({
    ...details,
    description: details.description?.trim() || undefined,
    name: details.name.trim(),
    schedule:
      details.schedule.kind === "weekdays"
        ? { ...details.schedule, days: [...details.schedule.days].sort() }
        : details.schedule,
  });

  const requireCheckableHabit = async (
    habitId: string,
    localDate: CalendarDay,
  ) => {
    const validDate = calendarDaySchema.parse(localDate);
    const habit = await habits.require(habitId);
    if (
      habit.archivedAt !== undefined ||
      !isHabitEligibleOn(habit, validDate)
    ) {
      throw new PersistenceError("conflict");
    }
    return { habit, validDate };
  };

  return {
    archive: (id) => habits.archive(id),
    async checkIn(habitId, localDate, status, note) {
      const { validDate } = await requireCheckableHabit(habitId, localDate);
      return entries.setForDate({
        habitId,
        localDate: validDate,
        note: note?.trim() || undefined,
        status,
      });
    },
    create: (details) => habits.create(normalizeDetails(details)),
    list: (options) => habits.list(options),
    listEntries: (habitId, range) => entries.listForHabit(habitId, range),
    async reopenCheckIn(habitId, localDate) {
      const { validDate } = await requireCheckableHabit(habitId, localDate);
      return entries.clearForDate(habitId, validDate);
    },
    restore: (id) => habits.restore(id),
    updateDetails: (id, details) =>
      habits.update(id, normalizeDetails(details)),
  };
}

export const personalOsHabitService = createHabitService(
  personalOsHabitRepository,
  personalOsHabitEntryRepository,
);
