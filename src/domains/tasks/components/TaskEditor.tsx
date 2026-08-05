import { useId, useState, type FormEvent } from "react";

import {
  Button,
  Dialog,
  Input,
  Select,
  Textarea,
} from "../../../components/ui";
import {
  taskCategories,
  taskPriorityLabels,
  type Task,
  type TaskDetails,
} from "../model";
import {
  parseTaskFormValues,
  taskToFormValues,
  type TaskFormErrors,
  type TaskFormValues,
} from "../task-form-values";

type TaskEditorProps = {
  /** Auswählbare Ziele. Ohne Ziele entfällt die Auswahl nicht, sie bleibt leer. */
  goalOptions?: ReadonlyArray<{ id: string; title: string }>;
  isSaving: boolean;
  onClose: () => void;
  onSave: (details: TaskDetails) => Promise<boolean>;
  task: Task;
};

export function TaskEditor({
  goalOptions = [],
  isSaving,
  onClose,
  onSave,
  task,
}: TaskEditorProps) {
  const formId = useId();
  const [values, setValues] = useState<TaskFormValues>(() =>
    taskToFormValues(task),
  );
  const [errors, setErrors] = useState<TaskFormErrors>({});

  const update = (field: keyof TaskFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({
      ...current,
      [field]: undefined,
      form: undefined,
    }));
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = parseTaskFormValues(values);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    if (await onSave(result.data)) {
      onClose();
    }
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
            loadingLabel="Aufgabe wird gespeichert …"
            type="submit"
          >
            Änderungen speichern
          </Button>
        </>
      }
      description="Passe Planung und Details an. Statusänderungen bleiben eigene, reversible Aktionen."
      onClose={onClose}
      open
      title="Aufgabe bearbeiten"
    >
      <form
        className="task-editor-form"
        id={formId}
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <Input
          autoFocus
          error={errors.title}
          label="Titel"
          maxLength={501}
          onChange={(event) => update("title", event.currentTarget.value)}
          required
          value={values.title}
        />
        <Textarea
          error={errors.notes}
          label="Notiz"
          maxLength={50_001}
          onChange={(event) => update("notes", event.currentTarget.value)}
          value={values.notes}
        />
        <div className="task-editor-grid">
          <Select
            label="Priorität"
            onChange={(event) => update("priority", event.currentTarget.value)}
            value={values.priority}
          >
            {Object.entries(taskPriorityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            error={errors.categoryId}
            label="Kategorie"
            onChange={(event) =>
              update("categoryId", event.currentTarget.value)
            }
            value={values.categoryId}
          >
            <option value="">Ohne Kategorie</option>
            {taskCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </Select>
          {/* Verknüpfung ist opt-in und macht die Erfassung nicht länger. */}
          <Select
            hint="Optional. Eine Aufgabe funktioniert auch ohne Ziel."
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
          <Input
            error={errors.plannedDate}
            label="Plandatum"
            onChange={(event) =>
              update("plannedDate", event.currentTarget.value)
            }
            type="date"
            value={values.plannedDate}
          />
          <Input
            error={errors.dueLocal}
            label="Fällig am"
            onChange={(event) => update("dueLocal", event.currentTarget.value)}
            type="datetime-local"
            value={values.dueLocal}
          />
          <Input
            error={errors.estimatedMinutes}
            inputMode="numeric"
            label="Schätzung in Minuten"
            max="100000"
            min="1"
            onChange={(event) =>
              update("estimatedMinutes", event.currentTarget.value)
            }
            step="1"
            type="number"
            value={values.estimatedMinutes}
          />
        </div>
        {errors.form ? (
          <p className="task-form-error" role="alert">
            {errors.form}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
