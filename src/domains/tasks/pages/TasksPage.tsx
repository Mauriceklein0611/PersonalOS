import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  useTimeZone,
  useWeekStartsOn,
} from "../../../app/settings/settings-context";
import {
  Button,
  Input,
  PageToolbar,
  SearchField,
  Select,
  Toast,
  ViewPurpose,
} from "../../../components/ui";
import type { WeekStartsOn } from "../../../lib/dates/calendar-days";
import type { CalendarDay } from "../../../lib/dates/date-values";
import { createSearchMatcher } from "../../../lib/text/search-terms";
import {
  personalOsGoalLinkService,
  type GoalLinkService,
  type GoalOption,
} from "../../goals/link-service";
import { TaskRow } from "../components/TaskRow";
import { TaskEditor } from "../components/TaskEditor";
import { TaskWeekPlanner } from "../components/TaskWeekPlanner";
import type { Task, TaskDetails } from "../model";
import { createTaskQueryContext, queryTasks, type TaskView } from "../queries";
import { personalOsTaskService, type TaskService } from "../service";
import { formatCalendarDay } from "../view-model";
import { buildTaskWeekPlan } from "../week-plan";
import "./tasks-page.css";

/**
 * Der Wochenplan ist eine zusätzliche Sicht auf dieselben Aufgaben und keine
 * Abfrage über `queryTasks`: Er zeigt geplante Tage, nicht eine gefilterte
 * Liste.
 */
type TasksPageView = TaskView | "weekPlan";

const taskViews: Array<{
  empty?: string;
  id: TasksPageView;
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
    empty:
      "In diesem Zeitraum gibt es keine offene Aufgabe mit Plandatum oder Frist.",
    id: "week",
    label: "Wochenliste",
  },
  { id: "weekPlan", label: "Wochenplan" },
  {
    empty: "Es gibt noch keine erledigten oder abgebrochenen Aufgaben.",
    id: "completed",
    label: "Erledigt",
  },
];

const taskListViews = taskViews.filter(
  (view): view is (typeof taskViews)[number] & { id: TaskView } =>
    view.id !== "weekPlan",
);

export type TasksPageProps = {
  goalLinks?: GoalLinkService;
  now?: () => Date;
  service?: TaskService;
  timeZone?: string;
  weekStartsOn?: WeekStartsOn;
};

export function TasksPage({
  goalLinks = personalOsGoalLinkService,
  now = systemNow,
  service = personalOsTaskService,
  timeZone: timeZoneOverride,
  weekStartsOn: weekStartsOnOverride,
}: TasksPageProps) {
  const timeZone = useTimeZone(timeZoneOverride);
  const weekStartsOn = useWeekStartsOn(weekStartsOnOverride);
  const [activeView, setActiveView] = useState<TasksPageView>("inbox");
  const [selectedDay, setSelectedDay] = useState<CalendarDay>();
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
    () => createTaskQueryContext(now(), timeZone, weekStartsOn),
    [now, timeZone, weekStartsOn],
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
  const listView = activeView === "weekPlan" ? undefined : activeView;
  const visibleTasks = listView
    ? queryTasks(matchingTasks, listView, context)
    : [];
  const weekPlan = useMemo(
    () =>
      buildTaskWeekPlan({
        tasks: matchingTasks,
        today: context.today,
        weekStartsOn,
      }),
    [context.today, matchingTasks, weekStartsOn],
  );
  const searchResultLabel = !matcher.isActive
    ? undefined
    : listView
      ? `${visibleTasks.length} von ${queryTasks(tasks, listView, context).length} Aufgaben in dieser Ansicht`
      : `${weekPlan.planned} von ${buildTaskWeekPlan({ tasks, today: context.today, weekStartsOn }).planned} Aufgaben in dieser Ansicht`;

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
    <section
      className="route-page tasks-page"
      aria-labelledby="page-title"
      data-surface="work"
    >
      <PageToolbar
        actions={
          <>
            <Button
              aria-pressed={activeView !== "weekPlan"}
              onClick={() => setActiveView("inbox")}
              variant={activeView !== "weekPlan" ? "secondary" : "ghost"}
            >
              Liste
            </Button>
            <Button
              aria-pressed={activeView === "weekPlan"}
              onClick={() => setActiveView("weekPlan")}
              variant={activeView === "weekPlan" ? "secondary" : "ghost"}
            >
              Wochenplan
            </Button>
          </>
        }
        description="Erfasse schnell, filtere den Bestand oder plane bewusst in derselben breiten Arbeitsfläche."
        eyebrow="Planung"
        surface="work"
        title="Aufgaben"
      />

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

      <div className="task-filter-toolbar">
        {activeView !== "weekPlan" ? (
          <Select
            label="Aufgaben filtern"
            onChange={(event) =>
              setActiveView(event.currentTarget.value as TaskView)
            }
            value={activeView}
          >
            {taskListViews.map((view) => {
              const count = queryTasks(matchingTasks, view.id, context).length;
              return (
                <option key={view.id} value={view.id}>
                  {view.label} · {count}
                </option>
              );
            })}
          </Select>
        ) : (
          <p className="task-plan-count">
            {weekPlan.planned} geplante Aufgaben
          </p>
        )}
        <SearchField
          hint="Sucht in Titel und Notiz der angezeigten Arbeitsfläche."
          label="Aufgaben durchsuchen"
          onChange={setSearchTerm}
          placeholder="Zum Beispiel Rechnung"
          resultLabel={searchResultLabel}
          value={searchTerm}
        />
      </div>

      <div
        aria-label={
          activeView === "weekPlan"
            ? "Wochenplan"
            : `${taskViews.find((view) => view.id === activeView)?.label} Aufgabenliste`
        }
        aria-live="polite"
        className="task-view-panel"
        id="task-view-panel"
        role="region"
      >
        {activeView === "week" ? (
          <ViewPurpose
            period={`${formatCalendarDay(weekPlan.from)} bis ${formatCalendarDay(weekPlan.to)}`}
            purpose="Die Wochenliste bündelt offene Aufgaben, deren Plandatum oder Frist in diesem Zeitraum liegt. Sie ordnet nicht nach einzelnen Tagen."
            question="Was muss ich diese Woche im Blick behalten?"
          />
        ) : null}
        {isLoading ? (
          <p className="task-view-state" role="status">
            Aufgaben werden geladen …
          </p>
        ) : listView === undefined &&
          !(matcher.isActive && weekPlan.planned === 0) ? (
          <TaskWeekPlanner
            busyTaskId={busyTaskId}
            context={context}
            goalTitles={goalTitles}
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
            onSelectDay={setSelectedDay}
            plan={weekPlan}
            /* Ein Tageswechsel über Mitternacht darf keine Auswahl außerhalb
               der Woche stehen lassen. */
            selectedDay={
              selectedDay !== undefined &&
              selectedDay >= weekPlan.from &&
              selectedDay <= weekPlan.to
                ? selectedDay
                : context.today
            }
          />
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
          <ul
            aria-label="Aufgaben dieser Ansicht"
            className="ui-dense-panel ui-dense-list task-list"
          >
            {visibleTasks.map((task) => (
              <TaskRow
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
          </ul>
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
