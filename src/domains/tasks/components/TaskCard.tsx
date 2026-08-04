import { Button } from "../../../components/ui";
import { getTaskCategoryLabel, taskPriorityLabels, type Task } from "../model";
import { isTaskOverdue, type TaskQueryContext } from "../queries";

type TaskCardProps = {
  busy: boolean;
  context: TaskQueryContext;
  onArchive: (task: Task) => void;
  onCancel: (task: Task) => void;
  onComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onReopen: (task: Task) => void;
  task: Task;
};

export function TaskCard({
  busy,
  context,
  onArchive,
  onCancel,
  onComplete,
  onEdit,
  onReopen,
  task,
}: TaskCardProps) {
  const headingId = `task-${task.id}`;
  const category = getTaskCategoryLabel(task.categoryId);
  const overdue = isTaskOverdue(task, context);

  return (
    <article className="task-card" aria-labelledby={headingId}>
      <div className="task-card-heading">
        <div>
          <p className="task-card-meta">
            <span>{taskPriorityLabels[task.priority]}</span>
            {category ? <span>{category}</span> : null}
            {overdue ? <strong>Überfällig</strong> : null}
            {task.status === "completed" ? <strong>Erledigt</strong> : null}
            {task.status === "cancelled" ? <strong>Abgebrochen</strong> : null}
          </p>
          <h2 id={headingId}>{task.title}</h2>
        </div>
      </div>

      {task.notes ? <p className="task-notes">{task.notes}</p> : null}
      <dl className="task-details">
        {task.plannedDate ? (
          <div>
            <dt>Geplant</dt>
            <dd>{formatCalendarDay(task.plannedDate)}</dd>
          </div>
        ) : null}
        {task.dueAt ? (
          <div>
            <dt>Fällig</dt>
            <dd>{formatInstant(task.dueAt, context.timeZone)}</dd>
          </div>
        ) : null}
        {task.estimatedMinutes ? (
          <div>
            <dt>Schätzung</dt>
            <dd>{task.estimatedMinutes} Min.</dd>
          </div>
        ) : null}
      </dl>

      <div className="task-actions">
        {task.status === "open" ? (
          <>
            <Button
              aria-label={`„${task.title}“ abschließen`}
              disabled={busy}
              onClick={() => onComplete(task)}
            >
              Abschließen
            </Button>
            <Button
              aria-label={`„${task.title}“ abbrechen`}
              disabled={busy}
              onClick={() => onCancel(task)}
              variant="ghost"
            >
              Abbrechen
            </Button>
          </>
        ) : (
          <Button
            aria-label={`„${task.title}“ wieder öffnen`}
            disabled={busy}
            onClick={() => onReopen(task)}
          >
            Wieder öffnen
          </Button>
        )}
        <Button
          aria-label={`„${task.title}“ bearbeiten`}
          disabled={busy}
          onClick={() => onEdit(task)}
          variant="secondary"
        >
          Bearbeiten
        </Button>
        <Button
          aria-label={`„${task.title}“ archivieren`}
          disabled={busy}
          onClick={() => onArchive(task)}
          variant="ghost"
        >
          Archivieren
        </Button>
      </div>
    </article>
  );
}

function formatCalendarDay(value: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatInstant(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}
