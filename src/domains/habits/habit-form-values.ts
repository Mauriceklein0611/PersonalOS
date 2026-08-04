import { calendarDaySchema } from "../../lib/dates/date-values";
import {
  habitDetailsSchema,
  type Habit,
  type HabitDetails,
  type HabitSchedule,
} from "./model";

export type HabitFormValues = {
  count: string;
  description: string;
  endDate: string;
  name: string;
  scheduleKind: HabitSchedule["kind"];
  startDate: string;
  weekdays: number[];
};

export type HabitFormErrors = Partial<
  Record<keyof HabitFormValues | "form", string>
>;

export type HabitFormParseResult =
  | { success: true; data: HabitDetails }
  | { success: false; errors: HabitFormErrors };

export function parseHabitFormValues(
  values: HabitFormValues,
  preserved: Pick<Habit, "categoryId" | "color" | "goalId"> = {},
): HabitFormParseResult {
  const errors: HabitFormErrors = {};
  const name = values.name.trim();
  const description = values.description.trim();
  if (name.length === 0) {
    errors.name = "Gib einen Namen mit mindestens einem Zeichen ein.";
  } else if (name.length > 500) {
    errors.name = "Der Name darf höchstens 500 Zeichen enthalten.";
  }
  if (description.length > 50_000) {
    errors.description =
      "Die Beschreibung darf höchstens 50.000 Zeichen enthalten.";
  }
  if (!calendarDaySchema.safeParse(values.startDate).success) {
    errors.startDate = "Wähle ein gültiges Startdatum.";
  }
  if (
    values.endDate !== "" &&
    !calendarDaySchema.safeParse(values.endDate).success
  ) {
    errors.endDate = "Wähle ein gültiges Enddatum.";
  } else if (values.endDate !== "" && values.endDate < values.startDate) {
    errors.endDate = "Das Enddatum darf nicht vor dem Startdatum liegen.";
  }

  let schedule: HabitSchedule;
  if (values.scheduleKind === "daily") {
    schedule = { kind: "daily" };
  } else if (values.scheduleKind === "weekdays") {
    if (values.weekdays.length === 0) {
      errors.weekdays = "Wähle mindestens einen Wochentag.";
    }
    schedule = { kind: "weekdays", days: [...values.weekdays].sort() };
  } else {
    const count = Number(values.count);
    if (!Number.isInteger(count) || count < 1 || count > 7) {
      errors.count = "Wähle eine Häufigkeit zwischen 1 und 7 pro Woche.";
    }
    schedule = { kind: "timesPerWeek", count };
  }

  if (Object.keys(errors).length > 0) return { success: false, errors };
  const result = habitDetailsSchema.safeParse({
    ...preserved,
    description: description || undefined,
    endDate: values.endDate || undefined,
    name,
    schedule,
    startDate: values.startDate,
  });
  return result.success
    ? { success: true, data: result.data }
    : {
        success: false,
        errors: { form: "Prüfe die eingegebenen Gewohnheitsdaten." },
      };
}

export function habitToFormValues(
  habit: Habit | undefined,
  today: string,
): HabitFormValues {
  return {
    count:
      habit?.schedule.kind === "timesPerWeek"
        ? habit.schedule.count.toString()
        : "3",
    description: habit?.description ?? "",
    endDate: habit?.endDate ?? "",
    name: habit?.name ?? "",
    scheduleKind: habit?.schedule.kind ?? "daily",
    startDate: habit?.startDate ?? today,
    weekdays: habit?.schedule.kind === "weekdays" ? habit.schedule.days : [1],
  };
}
