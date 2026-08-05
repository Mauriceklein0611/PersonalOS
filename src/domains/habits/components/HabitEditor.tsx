import { useId, useState, type FormEvent } from "react";

import {
  Button,
  Checkbox,
  Dialog,
  Input,
  Select,
  Textarea,
} from "../../../components/ui";
import type { CalendarDay } from "../../../lib/dates/date-values";
import {
  habitToFormValues,
  parseHabitFormValues,
  type HabitFormErrors,
  type HabitFormValues,
} from "../habit-form-values";
import type { Habit, HabitDetails } from "../model";

type HabitEditorProps = {
  /** Auswählbare Ziele; ohne Ziele bleibt die Auswahl leer. */
  goalOptions?: ReadonlyArray<{ id: string; title: string }>;
  habit?: Habit;
  isSaving: boolean;
  onClose: () => void;
  onSave: (details: HabitDetails) => Promise<boolean>;
  today: CalendarDay;
};

const weekdays = [
  { label: "Montag", value: 1 },
  { label: "Dienstag", value: 2 },
  { label: "Mittwoch", value: 3 },
  { label: "Donnerstag", value: 4 },
  { label: "Freitag", value: 5 },
  { label: "Samstag", value: 6 },
  { label: "Sonntag", value: 7 },
];

export function HabitEditor({
  goalOptions = [],
  habit,
  isSaving,
  onClose,
  onSave,
  today,
}: HabitEditorProps) {
  const formId = useId();
  const [values, setValues] = useState<HabitFormValues>(() =>
    habitToFormValues(habit, today),
  );
  const [errors, setErrors] = useState<HabitFormErrors>({});

  const update = (field: keyof HabitFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({
      ...current,
      [field]: undefined,
      form: undefined,
    }));
  };

  const toggleWeekday = (day: number, checked: boolean) => {
    setValues((current) => ({
      ...current,
      weekdays: checked
        ? [...new Set([...current.weekdays, day])].sort()
        : current.weekdays.filter((value) => value !== day),
    }));
    setErrors((current) => ({ ...current, weekdays: undefined }));
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = parseHabitFormValues(
      values,
      habit
        ? {
            categoryId: habit.categoryId,
            color: habit.color,
            goalId: habit.goalId,
          }
        : undefined,
    );
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    if (await onSave(result.data)) onClose();
  }

  return (
    <Dialog
      actions={
        <>
          <Button disabled={isSaving} onClick={onClose} variant="secondary">
            Abbrechen
          </Button>
          <Button
            form={formId}
            isLoading={isSaving}
            loadingLabel="Gewohnheit wird gespeichert …"
            type="submit"
          >
            {habit ? "Änderungen speichern" : "Gewohnheit anlegen"}
          </Button>
        </>
      }
      description={
        habit
          ? "Bestehende Check-ins bleiben gespeichert. Der gewählte Rhythmus steuert die künftigen fälligen Tage."
          : "Lege einen klaren, realistischen Rhythmus fest. Du kannst ihn später anpassen."
      }
      onClose={onClose}
      open
      title={habit ? "Gewohnheit bearbeiten" : "Gewohnheit anlegen"}
    >
      <form
        className="habit-editor-form"
        id={formId}
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <Input
          autoFocus
          error={errors.name}
          label="Name"
          maxLength={501}
          onChange={(event) => update("name", event.currentTarget.value)}
          required
          value={values.name}
        />
        <Textarea
          error={errors.description}
          label="Beschreibung"
          maxLength={50_001}
          onChange={(event) => update("description", event.currentTarget.value)}
          value={values.description}
        />
        {/* Verknüpfung ist opt-in und erhöht die Pflichtfelder nicht. */}
        <Select
          hint="Optional. Eine Gewohnheit funktioniert auch ohne Ziel."
          label="Ziel"
          onChange={(event) => update("goalId", event.currentTarget.value)}
          value={values.goalId}
        >
          <option value="">Ohne Ziel</option>
          {goalOptions.map((goal) => (
            <option key={goal.id} value={goal.id}>
              {goal.title}
            </option>
          ))}
        </Select>
        <Select
          hint={
            habit
              ? "Ein geänderter Rhythmus gilt ab heute für künftige Tage. Bereits erfasste Check-ins bleiben unverändert. Weil frühere Rhythmen nicht gespeichert werden, rechnet auch die Rückschau mit dem aktuellen Rhythmus."
              : "Du kannst den Rhythmus später anpassen."
          }
          label="Rhythmus"
          onChange={(event) =>
            update("scheduleKind", event.currentTarget.value)
          }
          value={values.scheduleKind}
        >
          <option value="daily">Täglich</option>
          <option value="weekdays">An ausgewählten Wochentagen</option>
          <option value="timesPerWeek">Mehrmals pro Woche</option>
        </Select>

        {values.scheduleKind === "weekdays" ? (
          <fieldset className="habit-weekday-fieldset">
            <legend>Wochentage</legend>
            <div className="habit-weekday-options">
              {weekdays.map((weekday) => (
                <Checkbox
                  checked={values.weekdays.includes(weekday.value)}
                  key={weekday.value}
                  label={weekday.label}
                  onChange={(event) =>
                    toggleWeekday(weekday.value, event.currentTarget.checked)
                  }
                />
              ))}
            </div>
            {errors.weekdays ? (
              <p className="habit-form-error" role="alert">
                {errors.weekdays}
              </p>
            ) : null}
          </fieldset>
        ) : null}

        {values.scheduleKind === "timesPerWeek" ? (
          <Input
            error={errors.count}
            inputMode="numeric"
            label="Wie oft pro Woche?"
            max="7"
            min="1"
            onChange={(event) => update("count", event.currentTarget.value)}
            step="1"
            type="number"
            value={values.count}
          />
        ) : null}

        <div className="habit-editor-dates">
          <Input
            disabled={habit !== undefined}
            error={errors.startDate}
            hint={
              habit
                ? "Das ursprüngliche Startdatum bleibt für die Historie erhalten."
                : undefined
            }
            label="Startdatum"
            onChange={(event) => update("startDate", event.currentTarget.value)}
            required
            type="date"
            value={values.startDate}
          />
          <Input
            error={errors.endDate}
            hint="Optional. Ein vergangenes Enddatum erscheint als pausierter Zustand."
            label="Enddatum"
            min={habit ? habit.startDate : values.startDate}
            onChange={(event) => update("endDate", event.currentTarget.value)}
            type="date"
            value={values.endDate}
          />
        </div>
        {errors.form ? (
          <p className="habit-form-error" role="alert">
            {errors.form}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
