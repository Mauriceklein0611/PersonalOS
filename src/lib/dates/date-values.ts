import { z } from "zod";

export const isoInstantSchema = z.iso.datetime({ precision: 3 });
export const calendarDaySchema = z.iso.date();
export const calendarMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const timeZoneSchema = z
  .string()
  .min(1)
  .max(100)
  .refine((timeZone) => {
    try {
      new Intl.DateTimeFormat("de-DE", { timeZone }).format(0);
      return true;
    } catch {
      return false;
    }
  });

export type IsoInstant = z.infer<typeof isoInstantSchema>;
export type CalendarDay = z.infer<typeof calendarDaySchema>;
export type CalendarMonth = z.infer<typeof calendarMonthSchema>;
export type TimeZone = z.infer<typeof timeZoneSchema>;

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export function createIsoInstant(date: Date): IsoInstant {
  return isoInstantSchema.parse(date.toISOString());
}

export function parseIsoInstant(value: unknown): IsoInstant {
  return isoInstantSchema.parse(value);
}

export function parseCalendarDay(value: unknown): CalendarDay {
  return calendarDaySchema.parse(value);
}

export function parseCalendarMonth(value: unknown): CalendarMonth {
  return calendarMonthSchema.parse(value);
}

export function nextUpdatedAt(
  previousUpdatedAt: IsoInstant,
  clock: Clock = systemClock,
): IsoInstant {
  const candidate = createIsoInstant(clock.now());
  return candidate < previousUpdatedAt ? previousUpdatedAt : candidate;
}
