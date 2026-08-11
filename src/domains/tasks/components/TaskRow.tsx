import { Button, IconButton } from "../../../components/ui";
import { getTaskCategoryLabel, taskPriorityLabels, type Task } from "../model";
import { type TaskQueryContext } from "../queries";
import { describeTaskTiming, formatCalendarDay } from "../view-model";
import { TaskRowActions } from "./TaskRowActions";

type TaskRowProps = {
  busy: boolean;
  context: TaskQueryContext;
  /**
   * Die Ebene des Titels. In einer Liste unter der Seitenüberschrift ist das
   * die zweite; steht die Zeile unter einer Tagesüberschrift, die dritte.
   */
  headingLevel?: 2 | 3;
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

/**
 * Eine Aufgabe als Zeile, nicht als Karte.
 *
 * Vier gleich schwere Schaltflächen je Aufgabe sind keine Auswahl, sondern
 * eine Suchaufgabe. Sichtbar bleibt deshalb genau die primäre Aktion —
 * abschließen beziehungsweise wieder öffnen; Bearbeiten, Abbrechen und
 * Archivieren liegen hinter „Weitere Aktionen“.
 */
export function TaskRow({
  busy,
  context,
  goalTitle,
  headingLevel = 2,
  onArchive,
  onCancel,
  onComplete,
  onEdit,
  onReopen,
  task,
}: TaskRowProps) {
  const headingId = `task-${task.id}`;
  const timing = describeTaskTiming(task, context);
  const isOpen = task.status === "open";
  const Title = headingLevel === 3 ? "h3" : "h2";

  /*
   * Eine Zeile Metadaten in fester Reihenfolge. Plandatum und Frist stehen
   * getrennt und mit ihrem Datum — zu einem „überfällig“ verschmolzen wäre
   * nicht mehr erkennbar, ob eine Verabredung mit sich selbst oder eine
   * Vorgabe von außen verstrichen ist. Was fehlt, entfällt still: „Keine
   * Frist“ wäre auf jeder zweiten Zeile dieselbe Nichtaussage.
   */
  const facts = [
    taskPriorityLabels[task.priority],
    getTaskCategoryLabel(task.categoryId),
    task.plannedDate
      ? `Geplant: ${formatCalendarDay(task.plannedDate)}`
      : undefined,
    task.dueAt
      ? `Frist: ${formatInstant(task.dueAt, context.timeZone)}`
      : undefined,
    // Eine Aufgabe mit Frist, aber ohne Plandatum, ist für keinen Tag
    // eingeplant. Das ist ein eigener Zustand, kein Sonderfall von „geplant“.
    timing.state === "deadlineOnly" ? timing.label : undefined,
    task.plannedDate === undefined && task.dueAt === undefined
      ? "Ohne Termin"
      : undefined,
    task.estimatedMinutes ? `${task.estimatedMinutes} Min.` : undefined,
    goalTitle ? `Ziel: ${goalTitle}` : undefined,
    task.status === "completed" ? "Erledigt" : undefined,
    task.status === "cancelled" ? "Abgebrochen" : undefined,
  ].filter((entry): entry is string => entry !== undefined);

  return (
    <li
      aria-labelledby={headingId}
      className="ui-dense-row task-row"
      data-completed={task.status === "completed"}
      data-elapsed={timing.isElapsed}
    >
      <IconButton
        className="task-row-primary"
        disabled={busy}
        label={
          isOpen
            ? `„${task.title}“ abschließen`
            : `„${task.title}“ wieder öffnen`
        }
        onClick={() => (isOpen ? onComplete(task) : onReopen(task))}
      >
        {isOpen ? "○" : "↺"}
      </IconButton>

      <div className="ui-dense-row-main">
        <Title className="ui-dense-row-title task-row-title" id={headingId}>
          {task.title}
        </Title>
        <p className="ui-dense-row-meta task-row-facts">
          {/*
            Der verstrichene Zeitpunkt wird benannt, nicht nur markiert, und
            steht vorn: Er ist der einzige Grund, eine Zeile vorzuziehen.
          */}
          {timing.isElapsed ? <strong>{timing.label}</strong> : null}
          {facts.map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
        </p>
        {/*
          Die Notiz steht gekürzt auf einer Zeile. Vollständig gehört sie in
          die Bearbeitung: Eine mehrzeilige Notiz je Aufgabe machte aus der
          Liste wieder eine Kartenwand.
        */}
        {task.notes ? <p className="task-row-note">{task.notes}</p> : null}
      </div>

      {/*
        Jede Aktion nennt die Aufgabe im eigenen Namen. Der Name der
        Ausklappfläche allein reichte nicht: Wer die Liste per Schaltfläche
        durchgeht, hört sonst dreimal „Bearbeiten“ ohne Bezug.
      */}
      <TaskRowActions label={`Weitere Aktionen für „${task.title}“`}>
        <Button
          aria-label={`„${task.title}“ bearbeiten`}
          disabled={busy}
          onClick={() => onEdit(task)}
          variant="secondary"
        >
          Bearbeiten
        </Button>
        {isOpen ? (
          <Button
            aria-label={`„${task.title}“ abbrechen`}
            disabled={busy}
            onClick={() => onCancel(task)}
            variant="ghost"
          >
            Abbrechen
          </Button>
        ) : null}
        <Button
          aria-label={`„${task.title}“ archivieren`}
          disabled={busy}
          onClick={() => onArchive(task)}
          variant="ghost"
        >
          Archivieren
        </Button>
      </TaskRowActions>
    </li>
  );
}

function formatInstant(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}
