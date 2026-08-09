import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Link } from "react-router";

import { useTimeZone } from "../../../app/settings/settings-context";
import {
  Button,
  EmptyState,
  Input,
  MetricTile,
  ProgressRing,
  Toast,
} from "../../../components/ui";
import { getIsoWeekBounds } from "../../../lib/dates/calendar-days";
import type { CalendarDay } from "../../../lib/dates/date-values";
import {
  personalOsFinanceService,
  type FinanceService,
} from "../../finance/service";
import type { Habit, HabitEntryStatus } from "../../habits/model";
import {
  personalOsHabitService,
  type HabitService,
} from "../../habits/service";
import {
  personalOsJournalService,
  type JournalService,
} from "../../journal/service";
import type { Task } from "../../tasks/model";
import { personalOsTaskService, type TaskService } from "../../tasks/service";
import { describeTaskTiming } from "../../tasks/view-model";
import { QuickExpenseForm } from "../components/QuickExpenseForm";
import {
  buildTodayOverview,
  createTodayContext,
  type TodayGreeting,
  type TodayInput,
} from "../queries";
import "./today-page.css";

const greetings: Record<TodayGreeting, string> = {
  day: "Schön, dass du da bist.",
  evening: "Guten Abend.",
  morning: "Guten Morgen.",
};

type TodayUndoAction = {
  id: string;
  message: string;
  run: () => Promise<unknown>;
};

/**
 * Das Dashboard zeigt einen Ausschnitt, keine vollständige Liste. Wird
 * gekürzt, muss die Kürzung dastehen: Die Kachel darüber nennt die volle Zahl,
 * und ein stiller Abbruch wäre ein sichtbarer Widerspruch.
 */
const visibleTaskCount = 5;

const emptyInput: TodayInput = {
  entriesByHabit: new Map(),
  habits: [],
  journalEntries: [],
  tasks: [],
};

export type TodayPageProps = {
  financeService?: FinanceService;
  habitService?: HabitService;
  journalService?: JournalService;
  now?: () => Date;
  taskService?: TaskService;
  timeZone?: string;
};

export function TodayPage({
  financeService = personalOsFinanceService,
  habitService = personalOsHabitService,
  journalService = personalOsJournalService,
  now = systemNow,
  taskService = personalOsTaskService,
  timeZone: timeZoneOverride,
}: TodayPageProps) {
  const timeZone = useTimeZone(timeZoneOverride);
  const context = useMemo(
    () => createTodayContext(now(), timeZone),
    [now, timeZone],
  );
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();
  const [input, setInput] = useState<TodayInput>(emptyInput);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string>();
  const [quickError, setQuickError] = useState<string>();
  const [quickTitle, setQuickTitle] = useState("");
  const [undo, setUndo] = useState<TodayUndoAction>();

  useEffect(() => {
    let isCurrent = true;
    void readTodaySnapshot(
      { habitService, journalService, taskService },
      context.today,
    ).then(
      (snapshot) => {
        if (!isCurrent) return;
        setInput(snapshot);
        setIsLoading(false);
      },
      () => {
        if (!isCurrent) return;
        setError("Die Tagesübersicht konnte nicht geladen werden.");
        setIsLoading(false);
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [context.today, habitService, journalService, taskService]);

  const reload = useCallback(async () => {
    setInput(
      await readTodaySnapshot(
        { habitService, journalService, taskService },
        context.today,
      ),
    );
  }, [context.today, habitService, journalService, taskService]);

  // Die Verdichtung läuft über alle Aufgaben, Habits und Journaleinträge und
  // darf nicht bei jedem Tastendruck im Schnellerfassen-Feld neu rechnen.
  const overview = useMemo(
    () => buildTodayOverview(input, context),
    [context, input],
  );

  async function runAction(
    id: string,
    action: () => Promise<unknown>,
    successMessage: string,
    failureMessage: string,
  ) {
    setBusyId(id);
    setError(undefined);
    setUndo(undefined);
    try {
      await action();
      await reload();
      setNotice(successMessage);
      return true;
    } catch {
      setError(failureMessage);
      return false;
    } finally {
      setBusyId(undefined);
    }
  }

  async function runUndo(action: TodayUndoAction) {
    setBusyId(action.id);
    setError(undefined);
    setUndo(undefined);
    try {
      await action.run();
      await reload();
      setNotice(action.message);
    } catch {
      setError("Die Aktion konnte nicht rückgängig gemacht werden.");
    } finally {
      setBusyId(undefined);
    }
  }

  async function completeTask(task: Task) {
    const completed = await runAction(
      task.id,
      () => taskService.complete(task.id),
      "Die Aufgabe wurde abgeschlossen.",
      "Die Aufgabe konnte nicht abgeschlossen werden.",
    );
    if (completed) {
      setUndo({
        id: task.id,
        message: "Die Aufgabe ist wieder offen.",
        run: () => taskService.reopen(task.id),
      });
    }
  }

  async function checkInHabit(habit: Habit, status: HabitEntryStatus) {
    const saved = await runAction(
      habit.id,
      () => habitService.checkIn(habit.id, context.today, status),
      status === "done"
        ? "Der Check-in wurde gespeichert."
        : "Der Tag wurde als übersprungen gespeichert.",
      "Der Check-in konnte nicht gespeichert werden.",
    );
    if (saved) {
      setUndo({
        id: habit.id,
        message: "Der Check-in wurde entfernt.",
        run: () => habitService.reopenCheckIn(habit.id, context.today),
      });
    }
  }

  async function quickCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = quickTitle.trim();
    if (title.length === 0) {
      setQuickError("Gib einen Titel mit mindestens einem Zeichen ein.");
      return;
    }
    setQuickError(undefined);
    setError(undefined);
    try {
      // Auf der Tagesansicht erfasste Aufgaben gehören zu diesem Tag und
      // erscheinen dadurch sofort in der Liste statt still in der Inbox.
      await taskService.create({
        plannedDate: context.today,
        priority: "normal",
        title,
      });
      await reload();
      setQuickTitle("");
    } catch {
      setError("Die Aufgabe konnte nicht gespeichert werden.");
    }
  }

  return (
    <section aria-labelledby="page-title" className="route-page today-page">
      {/* Glas-Hero: Datum, Begrüßung und der Tagesring als einziges Glow. */}
      <header className="page-header today-hero">
        <div className="page-header-copy">
          <p className="page-eyebrow">Tagesübersicht</p>
          <h1 id="page-title">Heute</h1>
          <p className="page-description">
            {greetings[overview.greeting]} {formatToday(context.today)}
          </p>
          <p className="today-focus">
            {overview.mostImportantTask
              ? `Wichtigstes für heute: ${overview.mostImportantTask.title}`
              : "Für heute steht keine Aufgabe an. Du kannst den Tag frei einteilen."}
          </p>
        </div>
        <div className="page-header-aside">
          <ProgressRing
            caption={
              overview.habitDueCount === 0
                ? "Heute ist keine Gewohnheit fällig."
                : `${overview.habitSettledCount} von ${overview.habitDueCount} Gewohnheiten erfasst`
            }
            glow
            label="Tagesfortschritt"
            size="sm"
            value={
              overview.habitDueCount === 0
                ? null
                : overview.habitSettledCount / overview.habitDueCount
            }
            valueText={
              overview.habitDueCount === 0
                ? undefined
                : `${overview.habitSettledCount} von ${overview.habitDueCount}`
            }
          />
        </div>
      </header>

      {error ? (
        <p className="page-alert today-error" role="alert">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className="today-status" role="status">
          Tagesübersicht wird geladen …
        </p>
      ) : (
        <div className="page-grid">
          <div className="today-metrics" data-span="full">
            <MetricTile
              context={
                overview.overdueTaskCount > 0
                  ? `${overview.overdueTaskCount} davon überfällig`
                  : "Nichts überfällig"
              }
              label="Aufgaben heute"
              value={`${overview.openTasks.length} offen`}
            />
            <MetricTile
              context={
                overview.habitDueCount === 0
                  ? "Heute ist nichts geplant"
                  : `${overview.habitSettledCount} von ${overview.habitDueCount} erfasst`
              }
              label="Gewohnheiten heute"
              value={`${overview.dueHabits.length} offen`}
            />
            <MetricTile
              context={
                overview.journal.hasEntryToday
                  ? `${overview.journal.filledFieldCount} Felder ausgefüllt`
                  : "Freiwillig und jederzeit nachtragbar"
              }
              label="Abendreflexion"
              value={overview.journal.hasEntryToday ? "Erfasst" : "Offen"}
            />
          </div>

          <form
            className="today-quick-capture"
            data-span="full"
            onSubmit={(event) => void quickCreateTask(event)}
          >
            <Input
              autoComplete="off"
              error={quickError}
              hint="Die Aufgabe wird für heute geplant. Im Aufgabenbereich kannst du sie verschieben."
              label="Aufgabe für heute"
              maxLength={500}
              onChange={(event) => {
                setQuickTitle(event.currentTarget.value);
                setQuickError(undefined);
              }}
              placeholder="Was möchtest du festhalten?"
              value={quickTitle}
            />
            <Button type="submit">Aufgabe hinzufügen</Button>
          </form>

          {/* Was unbequem ist, unterbleibt: Eine Ausgabe braucht hier nur
              Betrag und Kategorie. */}
          <QuickExpenseForm
            onSaved={(transactionId, amount) => {
              setNotice(`Die Ausgabe über ${amount} wurde gebucht.`);
              setUndo({
                id: transactionId,
                message: "Die Ausgabe wurde archiviert.",
                run: () => financeService.archiveTransaction(transactionId),
              });
            }}
            service={financeService}
            today={context.today}
          />

          <section className="today-list-card">
            <h2>Aufgaben für heute</h2>
            {overview.openTasks.length === 0 ? (
              <EmptyState
                action={<Link to="/aufgaben">Zu den Aufgaben</Link>}
                description="Für heute ist nichts geplant oder überfällig."
                title="Keine offene Aufgabe"
              />
            ) : (
              <ul className="today-list">
                {overview.openTasks.slice(0, visibleTaskCount).map((task) => (
                  <li key={task.id}>
                    <div className="today-list-copy">
                      <h3>{task.title}</h3>
                      <p>
                        {describeTaskTiming(task, context).label}
                        {task.priority === "high" ? " · Hohe Priorität" : null}
                      </p>
                    </div>
                    <Button
                      aria-label={`„${task.title}“ abschließen`}
                      disabled={busyId === task.id}
                      onClick={() => void completeTask(task)}
                    >
                      Erledigt
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {overview.openTasks.length > visibleTaskCount ? (
              <p className="today-list-footer">
                {visibleTaskCount} von {overview.openTasks.length} gezeigt.{" "}
                <Link to="/aufgaben">Alle Aufgaben ansehen</Link>
              </p>
            ) : null}
          </section>

          <section className="today-list-card">
            <h2>Gewohnheiten für heute</h2>
            {overview.habitDueCount === 0 ? (
              <EmptyState
                action={<Link to="/gewohnheiten">Zu den Gewohnheiten</Link>}
                description="Heute ist laut deinen Rhythmen keine Gewohnheit fällig."
                title="Nichts fällig"
              />
            ) : overview.dueHabits.length === 0 ? (
              <p className="today-status" role="status">
                Alle {overview.habitDueCount} fälligen Gewohnheiten sind für
                heute erfasst.
              </p>
            ) : (
              <ul className="today-list">
                {overview.dueHabits.map(({ habit }) => (
                  <li key={habit.id}>
                    <div className="today-list-copy">
                      <h3>{habit.name}</h3>
                      <p>Heute fällig</p>
                    </div>
                    <div className="today-list-actions">
                      <Button
                        aria-label={`„${habit.name}“ heute erledigen`}
                        disabled={busyId === habit.id}
                        onClick={() => void checkInHabit(habit, "done")}
                      >
                        Erledigt
                      </Button>
                      <Button
                        aria-label={`„${habit.name}“ heute überspringen`}
                        disabled={busyId === habit.id}
                        onClick={() => void checkInHabit(habit, "skipped")}
                        variant="ghost"
                      >
                        Überspringen
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="today-journal-card">
            <h2>Reflexion</h2>
            <p>
              {overview.journal.hasEntryToday
                ? "Für heute ist eine Reflexion gespeichert."
                : "Für heute ist noch keine Reflexion gespeichert."}
            </p>
            {overview.journal.showEveningHint ? (
              <p className="today-journal-hint">
                Der Abend ist ein guter Moment dafür, wenn du magst.
              </p>
            ) : null}
            <p className="today-journal-mood">
              {describeMood(overview.journal)}
            </p>
            <Link to="/journal">Journal öffnen</Link>
          </div>
        </div>
      )}

      {notice ? (
        <div className="today-toast-region">
          <Toast
            action={
              undo
                ? { label: "Rückgängig", onClick: () => void runUndo(undo) }
                : undefined
            }
            message={notice}
            onDismiss={() => {
              setNotice(undefined);
              setUndo(undefined);
            }}
          />
        </div>
      ) : null}
    </section>
  );
}

async function readTodaySnapshot(
  services: {
    habitService: HabitService;
    journalService: JournalService;
    taskService: TaskService;
  },
  today: CalendarDay,
): Promise<TodayInput> {
  const [tasks, habits, journalEntries] = await Promise.all([
    services.taskService.list(),
    services.habitService.list(),
    services.journalService.list(),
  ]);
  const [weekStart] = getIsoWeekBounds(today);
  const entries = await Promise.all(
    habits.map((habit) =>
      services.habitService.listEntries(habit.id, {
        from: weekStart,
        to: today,
      }),
    ),
  );
  return {
    entriesByHabit: new Map(
      habits.map((habit, index) => [habit.id, entries[index]]),
    ),
    habits,
    journalEntries,
    tasks,
  };
}

function describeMood(journal: {
  lastMood?: { ageInDays: number; localDate: CalendarDay; value: number };
}): string {
  if (!journal.lastMood) {
    return "Es ist noch keine Stimmung erfasst.";
  }
  if (journal.lastMood.ageInDays === 0) {
    return `Heute erfasste Stimmung: ${journal.lastMood.value} von 5.`;
  }
  return `Zuletzt erfasste Stimmung: ${journal.lastMood.value} von 5, vom ${formatDay(journal.lastMood.localDate)}. Das ist ein Eintrag aus der Vergangenheit und nicht dein heutiger Stand.`;
}

function formatToday(day: CalendarDay): string {
  return formatDay(day);
}

function formatDay(day: CalendarDay): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00.000Z`));
}

export function Component() {
  return <TodayPage />;
}

function systemNow() {
  return new Date();
}
