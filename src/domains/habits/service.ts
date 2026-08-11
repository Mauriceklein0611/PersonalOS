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
  /**
   * Alle Check-ins eines Zeitraums, nach Routine gruppiert. Eine Ansicht, die
   * jede Routine einzeln fragt, stellt so viele Abfragen wie es Routinen gibt.
   */
  listEntriesByHabit(range?: {
    from?: CalendarDay;
    to?: CalendarDay;
  }): Promise<Map<string, HabitEntry[]>>;
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
    async listEntriesByHabit(range) {
      const found = await entries.listInRange(range);
      const grouped = new Map<string, HabitEntry[]>();
      for (const entry of found) {
        const current = grouped.get(entry.habitId);
        if (current === undefined) {
          grouped.set(entry.habitId, [entry]);
        } else {
          current.push(entry);
        }
      }
      // Die Reihenfolge je Routine ist Teil der Zusage, nicht der Index.
      for (const list of grouped.values()) {
        list.sort((left, right) =>
          left.localDate.localeCompare(right.localDate),
        );
      }
      return grouped;
    },
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
