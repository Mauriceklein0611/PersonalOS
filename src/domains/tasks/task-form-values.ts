import {
  calendarDaySchema,
  createIsoInstant,
} from "../../lib/dates/date-values";
import {
  taskDetailsSchema,
  type TaskDetails,
  type TaskPriority,
} from "./model";

export type TaskFormValues = {
  categoryId: string;
  dueLocal: string;
  estimatedMinutes: string;
  /** Optionale Zielreferenz. Leer bedeutet: gehört zu keinem Ziel. */
  goalId: string;
  notes: string;
  plannedDate: string;
  priority: TaskPriority;
  title: string;
};

export type TaskFormErrors = Partial<
  Record<keyof TaskFormValues | "form", string>
>;

export type TaskFormParseResult =
  | { success: true; data: TaskDetails }
  | { success: false; errors: TaskFormErrors };

export function parseTaskFormValues(
  values: TaskFormValues,
): TaskFormParseResult {
  const errors: TaskFormErrors = {};
  const title = values.title.trim();
  const notes = values.notes.trim();

  if (title.length === 0) {
    errors.title = "Gib einen Titel mit mindestens einem Zeichen ein.";
  } else if (title.length > 500) {
    errors.title = "Der Titel darf höchstens 500 Zeichen enthalten.";
  }
  if (notes.length > 50_000) {
    errors.notes = "Die Notiz darf höchstens 50.000 Zeichen enthalten.";
  }

  let estimatedMinutes: number | undefined;
  if (values.estimatedMinutes !== "") {
    estimatedMinutes = Number(values.estimatedMinutes);
    if (
      !Number.isInteger(estimatedMinutes) ||
      estimatedMinutes <= 0 ||
      estimatedMinutes > 100_000
    ) {
      errors.estimatedMinutes =
        "Gib eine ganze Dauer zwischen 1 und 100.000 Minuten ein.";
    }
  }

  const plannedDate = values.plannedDate || undefined;
  if (plannedDate && !calendarDaySchema.safeParse(plannedDate).success) {
    errors.plannedDate = "Wähle ein gültiges Plandatum.";
  }

  let dueAt: string | undefined;
  if (values.dueLocal !== "") {
    const dueDate = new Date(values.dueLocal);
    if (Number.isNaN(dueDate.getTime())) {
      errors.dueLocal = "Wähle einen gültigen Fälligkeitszeitpunkt.";
    } else {
      dueAt = createIsoInstant(dueDate);
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  const result = taskDetailsSchema.safeParse({
    categoryId: values.categoryId || undefined,
    dueAt,
    estimatedMinutes,
    goalId: values.goalId || undefined,
    notes: notes || undefined,
    plannedDate,
    priority: values.priority,
    title,
  });
  if (!result.success) {
    return {
      success: false,
      errors: { form: "Prüfe die eingegebenen Aufgabendaten." },
    };
  }
  return { success: true, data: result.data };
}

export function taskToFormValues(task: TaskDetails): TaskFormValues {
  return {
    categoryId: task.categoryId ?? "",
    dueLocal: task.dueAt ? toLocalDateTimeInput(task.dueAt) : "",
    estimatedMinutes: task.estimatedMinutes?.toString() ?? "",
    goalId: task.goalId ?? "",
    notes: task.notes ?? "",
    plannedDate: task.plannedDate ?? "",
    priority: task.priority,
    title: task.title,
  };
}

function toLocalDateTimeInput(instant: string): string {
  const date = new Date(instant);
  const part = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`;
}
