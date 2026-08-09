import { Button } from "../../../components/ui";
import { getTaskCategoryLabel, taskPriorityLabels, type Task } from "../model";
import { type TaskQueryContext } from "../queries";
import { describeTaskTiming } from "../view-model";

type TaskCardProps = {
  busy: boolean;
  context: TaskQueryContext;
  /**
   * Der Titel des verknüpften Ziels. Die Aufgabendomain löst die Kennung
   * nicht selbst auf — der Titel kommt über den Link-Service der Zieldomain
   * herein, damit keine Domain die andere direkt liest (`AGENTS.md` §3).
   */
  goalTitle?: string;
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
  goalTitle,
  onArchive,
  onCancel,
  onComplete,
  onEdit,
  onReopen,
  task,
}: TaskCardProps) {
  const headingId = `task-${task.id}`;
  const category = getTaskCategoryLabel(task.categoryId);
  const timing = describeTaskTiming(task, context);

  return (
    <article
      aria-labelledby={headingId}
      className="task-card"
      data-completed={task.status === "completed"}
    >
      <div className="task-card-heading">
        <div>
          <p className="task-card-meta">
            <span>{taskPriorityLabels[task.priority]}</span>
            {category ? <span>{category}</span> : null}
            {/*
              Der verstrichene Zeitpunkt wird benannt, nicht nur markiert:
              „überfällig“ allein verriet nicht, ob das eigene Plandatum oder
              eine Frist gemeint war. Eine Aufgabe ohne Plandatum sagt das
              ebenfalls, damit sie nicht als eingeplant gelesen wird.
            */}
            {timing.isElapsed ? <strong>{timing.label}</strong> : null}
            {timing.state === "deadlineOnly" ? (
              <span>{timing.label}</span>
            ) : null}
            {/* Erledigt und abgebrochen sind neutrale Zustände, kein Alarm. */}
            {task.status === "completed" ? <span>Erledigt</span> : null}
            {task.status === "cancelled" ? <span>Abgebrochen</span> : null}
          </p>
          <h2 id={headingId}>{task.title}</h2>
        </div>
      </div>

      {task.notes ? <p className="task-notes">{task.notes}</p> : null}
      <dl className="task-details">
        {/*
          Ohne Verknüpfung fehlt die Zeile ganz; ohne auflösbaren Titel
          ebenfalls. Ein Platzhalter oder eine nackte Kennung wäre für den
          Nutzer keine Auskunft.
        */}
        {goalTitle ? (
          <div>
            <dt>Ziel</dt>
            <dd>{goalTitle}</dd>
          </div>
        ) : null}
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
