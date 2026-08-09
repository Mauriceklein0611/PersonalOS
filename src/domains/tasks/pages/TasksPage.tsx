import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import { useTimeZone } from "../../../app/settings/settings-context";
import { Button, Input, SearchField, Toast } from "../../../components/ui";
import { createSearchMatcher } from "../../../lib/text/search-terms";
import {
  personalOsGoalLinkService,
  type GoalLinkService,
  type GoalOption,
} from "../../goals/link-service";
import { TaskCard } from "../components/TaskCard";
import { TaskEditor } from "../components/TaskEditor";
import type { Task, TaskDetails } from "../model";
import { createTaskQueryContext, queryTasks, type TaskView } from "../queries";
import { personalOsTaskService, type TaskService } from "../service";
import "./tasks-page.css";

const taskViews: Array<{
  empty: string;
  id: TaskView;
  label: string;
}> = [
  {
    empty: "Die Inbox ist leer. Erfasse oben eine Aufgabe mit Titel.",
    id: "inbox",
    label: "Inbox",
  },
  {
    empty: "Für heute ist nichts geplant oder überfällig.",
    id: "today",
    label: "Heute",
  },
  {
    empty: "Für diese Woche ist noch keine offene Aufgabe geplant.",
    id: "week",
    label: "Diese Woche",
  },
  {
    empty: "Es gibt noch keine erledigten oder abgebrochenen Aufgaben.",
    id: "completed",
    label: "Erledigt",
  },
];

export type TasksPageProps = {
  goalLinks?: GoalLinkService;
  now?: () => Date;
  service?: TaskService;
  timeZone?: string;
};

export function TasksPage({
  goalLinks = personalOsGoalLinkService,
  now = systemNow,
  service = personalOsTaskService,
  timeZone: timeZoneOverride,
}: TasksPageProps) {
  const timeZone = useTimeZone(timeZoneOverride);
  const [activeView, setActiveView] = useState<TaskView>("inbox");
  const [goalOptions, setGoalOptions] = useState<GoalOption[]>([]);
  const [goalTitles, setGoalTitles] = useState<ReadonlyMap<string, string>>(
    new Map(),
  );
  const [busyTaskId, setBusyTaskId] = useState<string>();
  const [editingTask, setEditingTask] = useState<Task>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string>();
  const [quickError, setQuickError] = useState<string>();
  const [quickTitle, setQuickTitle] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [undoTask, setUndoTask] = useState<Task>();
  const context = useMemo(
    () => createTaskQueryContext(now(), timeZone),
    [now, timeZone],
  );

  const refreshTasks = useCallback(async () => {
    setTasks(await service.list());
  }, [service]);

  // Die Zielauswahl ist optional. Schlägt sie fehl, bleibt sie leer und die
  // Aufgabenerfassung funktioniert unverändert weiter.
  useEffect(() => {
    let isCurrent = true;
    void Promise.all([goalLinks.listGoalOptions(), goalLinks.listGoalTitles()])
      .then(([options, titles]) => {
        if (!isCurrent) return;
        setGoalOptions(options);
        setGoalTitles(titles);
      })
      .catch(() => {
        if (!isCurrent) return;
        setGoalOptions([]);
        setGoalTitles(new Map());
      });
    return () => {
      isCurrent = false;
    };
  }, [goalLinks]);

  useEffect(() => {
    let isCurrent = true;
    void service.list().then(
      (loadedTasks) => {
        if (isCurrent) {
          setTasks(loadedTasks);
          setIsLoading(false);
        }
      },
      () => {
        if (isCurrent) {
          setError("Die Aufgaben konnten nicht geladen werden.");
          setIsLoading(false);
        }
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [service]);

  // Der Begriff filtert vor der Ansichtsabfrage. So kostet der Textvergleich
  // einmal je Aufgabe statt einmal je Aufgabe und Ansicht, und die Zähler der
  // Reiter zeigen dieselbe Auswahl wie die Liste darunter.
  const matcher = useMemo(() => createSearchMatcher(searchTerm), [searchTerm]);
  const matchingTasks = useMemo(
    () =>
      matcher.isActive
        ? tasks.filter((task) => matcher.matches(task.title, task.notes))
        : tasks,
    [matcher, tasks],
  );
  const visibleTasks = queryTasks(matchingTasks, activeView, context);
  const searchResultLabel = matcher.isActive
    ? `${visibleTasks.length} von ${queryTasks(tasks, activeView, context).length} Aufgaben in dieser Ansicht`
    : undefined;

  async function quickCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = quickTitle.trim();
    if (title.length === 0) {
      setQuickError("Gib einen Titel mit mindestens einem Zeichen ein.");
      return;
    }
    setQuickError(undefined);
    setError(undefined);
    try {
      await service.create({ priority: "normal", title });
      await refreshTasks();
      setQuickTitle("");
      setActiveView("inbox");
      setNotice("Die Aufgabe wurde in der Inbox gespeichert.");
    } catch {
      setError("Die Aufgabe konnte nicht gespeichert werden.");
    }
  }

  async function runTaskAction(
    task: Task,
    action: () => Promise<Task>,
    successMessage: string,
  ) {
    setBusyTaskId(task.id);
    setError(undefined);
    try {
      await action();
      await refreshTasks();
      setNotice(successMessage);
      return true;
    } catch {
      setError("Die Aufgabe konnte nicht geändert werden.");
      return false;
    } finally {
      setBusyTaskId(undefined);
    }
  }

  async function archiveTask(task: Task) {
    if (
      await runTaskAction(
        task,
        () => service.archive(task.id),
        "Die Aufgabe wurde archiviert.",
      )
    ) {
      setUndoTask(task);
    }
  }

  async function restoreArchivedTask() {
    if (!undoTask) return;
    const task = undoTask;
    setBusyTaskId(task.id);
    setError(undefined);
    try {
      await service.restore(task.id);
      await refreshTasks();
      setUndoTask(undefined);
      setNotice("Die Archivierung wurde rückgängig gemacht.");
    } catch {
      setError("Die Archivierung konnte nicht rückgängig gemacht werden.");
    } finally {
      setBusyTaskId(undefined);
    }
  }

  async function saveTask(details: TaskDetails) {
    if (!editingTask) return false;
    return runTaskAction(
      editingTask,
      () => service.updateDetails(editingTask.id, details),
      "Die Aufgabe wurde aktualisiert.",
    );
  }

  return (
    <section className="route-page tasks-page" aria-labelledby="page-title">
      <header className="page-header">
        <div className="page-header-copy">
          <p className="page-eyebrow">Planung</p>
          <h1 id="page-title">Aufgaben</h1>
          <p className="page-description">
            Erfasse schnell, plane bewusst und behalte nur den passenden
            Zeitraum im Blick.
          </p>
        </div>
      </header>

      <form
        className="task-quick-capture"
        onSubmit={(event) => void quickCreate(event)}
      >
        <Input
          autoComplete="off"
          error={quickError}
          label="Neue Aufgabe"
          maxLength={500}
          onChange={(event) => {
            setQuickTitle(event.currentTarget.value);
            setQuickError(undefined);
          }}
          placeholder="Was möchtest du festhalten?"
          required
          value={quickTitle}
        />
        <Button type="submit">Aufgabe hinzufügen</Button>
      </form>

      {error ? (
        <p className="page-alert task-page-error" role="alert">
          {error}
        </p>
      ) : null}

      <SearchField
        hint="Sucht in Titel und Notiz der angezeigten Ansicht."
        label="Aufgaben durchsuchen"
        onChange={setSearchTerm}
        placeholder="Zum Beispiel Rechnung"
        resultLabel={searchResultLabel}
        value={searchTerm}
      />

      <div
        className="task-view-tabs"
        role="tablist"
        aria-label="Aufgabenansicht"
      >
        {taskViews.map((view) => {
          const count = queryTasks(matchingTasks, view.id, context).length;
          return (
            <button
              aria-controls="task-view-panel"
              aria-selected={activeView === view.id}
              className="task-view-tab"
              key={view.id}
              onClick={() => setActiveView(view.id)}
              role="tab"
              type="button"
            >
              <span>{view.label}</span>
              <span aria-label={`${count} Aufgaben`}>{count}</span>
            </button>
          );
        })}
      </div>

      <div
        aria-live="polite"
        className="task-view-panel"
        id="task-view-panel"
        role="tabpanel"
      >
        {isLoading ? (
          <p className="task-view-state" role="status">
            Aufgaben werden geladen …
          </p>
        ) : visibleTasks.length === 0 ? (
          <div className="task-view-state" role="note">
            <strong>
              {matcher.isActive ? "Kein Treffer" : "Noch nichts hier"}
            </strong>
            <span>
              {matcher.isActive
                ? `Zu „${searchTerm.trim()}“ passt in dieser Ansicht keine Aufgabe. Prüfe die Schreibweise oder wechsle die Ansicht.`
                : taskViews.find((view) => view.id === activeView)?.empty}
            </span>
          </div>
        ) : (
          <div className="task-list">
            {visibleTasks.map((task) => (
              <TaskCard
                busy={busyTaskId === task.id}
                context={context}
                goalTitle={
                  task.goalId === undefined
                    ? undefined
                    : goalTitles.get(task.goalId)
                }
                key={task.id}
                onArchive={(selectedTask) => void archiveTask(selectedTask)}
                onCancel={(selectedTask) =>
                  void runTaskAction(
                    selectedTask,
                    () => service.cancel(selectedTask.id),
                    "Die Aufgabe wurde abgebrochen.",
                  )
                }
                onComplete={(selectedTask) =>
                  void runTaskAction(
                    selectedTask,
                    () => service.complete(selectedTask.id),
                    "Die Aufgabe wurde abgeschlossen.",
                  )
                }
                onEdit={setEditingTask}
                onReopen={(selectedTask) =>
                  void runTaskAction(
                    selectedTask,
                    () => service.reopen(selectedTask.id),
                    "Die Aufgabe ist wieder offen.",
                  )
                }
                task={task}
              />
            ))}
          </div>
        )}
      </div>

      {notice ? (
        <div className="task-toast-region">
          <Toast
            action={
              undoTask
                ? {
                    label: "Rückgängig",
                    onClick: () => void restoreArchivedTask(),
                  }
                : undefined
            }
            message={notice}
            onDismiss={() => {
              setNotice(undefined);
              setUndoTask(undefined);
            }}
          />
        </div>
      ) : null}

      {editingTask ? (
        <TaskEditor
          goalOptions={goalOptions}
          isSaving={busyTaskId === editingTask.id}
          key={editingTask.id}
          onClose={() => setEditingTask(undefined)}
          onSave={saveTask}
          task={editingTask}
        />
      ) : null}
    </section>
  );
}

export function Component() {
  return <TasksPage />;
}

function systemNow() {
  return new Date();
}
