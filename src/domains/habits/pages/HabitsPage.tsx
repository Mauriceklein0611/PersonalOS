import { useCallback, useEffect, useMemo, useState } from "react";

import { Button, EmptyState, Select, Toast } from "../../../components/ui";
import {
  addCalendarDays,
  calendarDayForInstant,
  enumerateCalendarDays,
  getIsoWeekBounds,
} from "../../../lib/dates/calendar-days";
import type { CalendarDay } from "../../../lib/dates/date-values";
import { HabitEditor } from "../components/HabitEditor";
import { HabitProgressCard } from "../components/HabitProgressCard";
import { HabitTodayCard } from "../components/HabitTodayCard";
import { HabitWeekGrid } from "../components/HabitWeekGrid";
import type {
  Habit,
  HabitDetails,
  HabitEntry,
  HabitEntryStatus,
} from "../model";
import { personalOsHabitService, type HabitService } from "../service";
import {
  formatCalendarDay,
  getHabitActivityState,
  getHabitDayState,
  getHabitScheduleLabel,
  habitProgressPeriodLabels,
  type HabitDayState,
  type HabitProgressPeriod,
} from "../view-model";
import "./habits-page.css";

type HabitsView = "archive" | "progress" | "today" | "week";

type HabitUndoAction = {
  habitId: string;
  message: string;
  run: () => Promise<unknown>;
};

const habitViews: Array<{ id: HabitsView; label: string }> = [
  { id: "today", label: "Heute" },
  { id: "week", label: "Woche" },
  { id: "progress", label: "Fortschritt" },
  { id: "archive", label: "Archiv" },
];

const progressPeriods: HabitProgressPeriod[] = [
  "last7Days",
  "last28Days",
  "sinceStart",
];

export type HabitsPageProps = {
  now?: () => Date;
  service?: HabitService;
  timeZone?: string;
};

export function HabitsPage({
  now = systemNow,
  service = personalOsHabitService,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
}: HabitsPageProps) {
  const [activeView, setActiveView] = useState<HabitsView>("today");
  const [busyHabitId, setBusyHabitId] = useState<string>();
  const [editor, setEditor] = useState<{ habit?: Habit }>();
  const [entriesByHabit, setEntriesByHabit] = useState<
    ReadonlyMap<string, HabitEntry[]>
  >(new Map());
  const [error, setError] = useState<string>();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [progressPeriod, setProgressPeriod] =
    useState<HabitProgressPeriod>("last28Days");
  const [undo, setUndo] = useState<HabitUndoAction>();
  const [weekOffset, setWeekOffset] = useState(0);

  const today = useMemo(
    () => calendarDayForInstant(now(), timeZone),
    [now, timeZone],
  );

  const load = useCallback(async () => {
    const snapshot = await readHabitSnapshot(service);
    setHabits(snapshot.habits);
    setEntriesByHabit(snapshot.entries);
  }, [service]);

  useEffect(() => {
    let isCurrent = true;
    void readHabitSnapshot(service).then(
      (snapshot) => {
        if (!isCurrent) return;
        setHabits(snapshot.habits);
        setEntriesByHabit(snapshot.entries);
        setIsLoading(false);
      },
      () => {
        if (isCurrent) {
          setError("Die Gewohnheiten konnten nicht geladen werden.");
          setIsLoading(false);
        }
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [service]);

  const entriesFor = useCallback(
    (habit: Habit) => entriesByHabit.get(habit.id) ?? [],
    [entriesByHabit],
  );

  const activeHabits = habits.filter(
    (habit) => getHabitActivityState(habit, today) === "active",
  );
  const upcomingHabits = habits.filter(
    (habit) => getHabitActivityState(habit, today) === "upcoming",
  );
  const pausedHabits = habits.filter(
    (habit) => getHabitActivityState(habit, today) === "paused",
  );
  const archivedHabits = habits.filter(
    (habit) => habit.archivedAt !== undefined,
  );
  const openHabits = activeHabits.filter(
    (habit) => getHabitDayState(habit, entriesFor(habit), today) === "open",
  );
  const settledHabits = activeHabits.filter((habit) => {
    const state = getHabitDayState(habit, entriesFor(habit), today);
    return state === "done" || state === "skipped";
  });
  const restingHabits = activeHabits.filter(
    (habit) => getHabitDayState(habit, entriesFor(habit), today) === "not-due",
  );

  const [weekStart, weekEnd] = getIsoWeekBounds(
    addCalendarDays(today, weekOffset * 7),
  );
  const weekDays = enumerateCalendarDays(weekStart, weekEnd);
  const weekHabits = habits.filter(
    (habit) =>
      habit.archivedAt === undefined &&
      habit.startDate <= weekEnd &&
      (habit.endDate === undefined || habit.endDate >= weekStart),
  );
  const trackedHabits = habits.filter(
    (habit) => habit.archivedAt === undefined,
  );

  const viewCounts: Record<HabitsView, number> = {
    archive: archivedHabits.length,
    progress: trackedHabits.length,
    today: openHabits.length,
    week: weekHabits.length,
  };

  async function runHabitAction(
    habit: Habit,
    action: () => Promise<unknown>,
    successMessage: string,
    failureMessage: string,
  ) {
    setBusyHabitId(habit.id);
    setError(undefined);
    setUndo(undefined);
    try {
      await action();
      await load();
      setNotice(successMessage);
      return true;
    } catch {
      setError(failureMessage);
      return false;
    } finally {
      setBusyHabitId(undefined);
    }
  }

  function checkIn(habit: Habit, status: HabitEntryStatus, day: CalendarDay) {
    return runHabitAction(
      habit,
      () => service.checkIn(habit.id, day, status),
      status === "done"
        ? "Der Check-in wurde gespeichert."
        : "Der Tag wurde als übersprungen gespeichert.",
      "Der Check-in konnte nicht gespeichert werden.",
    );
  }

  /**
   * „Wieder öffnen“ löscht den Tageseintrag samt Notiz. Der vorherige Stand
   * wird deshalb festgehalten und über „Rückgängig“ wieder eingetragen.
   */
  async function reopen(habit: Habit, day: CalendarDay) {
    const previous = entriesFor(habit).find(
      (entry) => entry.archivedAt === undefined && entry.localDate === day,
    );
    const reopened = await runHabitAction(
      habit,
      () => service.reopenCheckIn(habit.id, day),
      "Der Tag ist wieder offen. Der Check-in wurde entfernt.",
      "Der Tag konnte nicht wieder geöffnet werden.",
    );
    if (reopened && previous) {
      setUndo({
        habitId: habit.id,
        message: "Der Check-in wurde wiederhergestellt.",
        run: () =>
          service.checkIn(habit.id, day, previous.status, previous.note),
      });
    }
  }

  async function archiveHabit(habit: Habit) {
    const archived = await runHabitAction(
      habit,
      () => service.archive(habit.id),
      "Die Gewohnheit wurde archiviert. Die Check-ins bleiben erhalten.",
      "Die Gewohnheit konnte nicht archiviert werden.",
    );
    if (archived) {
      setUndo({
        habitId: habit.id,
        message: "Die Archivierung wurde rückgängig gemacht.",
        run: () => service.restore(habit.id),
      });
    }
  }

  async function runUndo(action: HabitUndoAction) {
    setBusyHabitId(action.habitId);
    setError(undefined);
    setUndo(undefined);
    try {
      await action.run();
      await load();
      setNotice(action.message);
    } catch {
      setError("Die Aktion konnte nicht rückgängig gemacht werden.");
    } finally {
      setBusyHabitId(undefined);
    }
  }

  async function restoreHabit(habit: Habit) {
    await runHabitAction(
      habit,
      () => service.restore(habit.id),
      "Die Gewohnheit ist wieder aktiv.",
      "Die Gewohnheit konnte nicht wiederhergestellt werden.",
    );
  }

  async function saveHabit(details: HabitDetails) {
    const habit = editor?.habit;
    setIsSaving(true);
    try {
      if (habit) {
        return await runHabitAction(
          habit,
          () => service.updateDetails(habit.id, details),
          "Gespeichert. Der Rhythmus gilt ab heute; erfasste Check-ins bleiben unverändert.",
          "Die Gewohnheit konnte nicht gespeichert werden.",
        );
      }
      setError(undefined);
      setUndo(undefined);
      await service.create(details);
      await load();
      setNotice("Die Gewohnheit wurde angelegt.");
      return true;
    } catch {
      setError("Die Gewohnheit konnte nicht gespeichert werden.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  function toggleWeekDay(habit: Habit, day: CalendarDay, state: HabitDayState) {
    void (state === "done" ? reopen(habit, day) : checkIn(habit, "done", day));
  }

  return (
    <section aria-labelledby="page-title" className="route-page habits-page">
      <p className="page-eyebrow">Routinen</p>
      <h1 id="page-title">Gewohnheiten</h1>
      <p className="page-description">
        Begleite wiederkehrende Routinen ohne Druck oder versteckte Bewertung.
      </p>

      <div className="habit-page-actions">
        <Button onClick={() => setEditor({})}>Neue Gewohnheit</Button>
      </div>

      {error ? (
        <p className="habit-page-error" role="alert">
          {error}
        </p>
      ) : null}

      <div
        aria-label="Gewohnheitsansicht"
        className="habit-view-tabs"
        role="tablist"
      >
        {habitViews.map((view) => (
          <button
            aria-controls="habit-view-panel"
            aria-selected={activeView === view.id}
            className="habit-view-tab"
            key={view.id}
            onClick={() => setActiveView(view.id)}
            role="tab"
            type="button"
          >
            <span>{view.label}</span>
            <span aria-label={`${viewCounts[view.id]} Gewohnheiten`}>
              {viewCounts[view.id]}
            </span>
          </button>
        ))}
      </div>

      <div
        aria-live="polite"
        className="habit-view-panel"
        id="habit-view-panel"
        role="tabpanel"
      >
        {isLoading ? (
          <p className="habit-view-status" role="status">
            Gewohnheiten werden geladen …
          </p>
        ) : activeView === "today" ? (
          <>
            <h2>Heute fällig</h2>
            {openHabits.length === 0 ? (
              <EmptyState
                description={
                  activeHabits.length === 0
                    ? "Lege eine Gewohnheit an, um deinen Tagesrhythmus zu begleiten."
                    : "Für heute ist alles erfasst. Du kannst den Tag so lassen."
                }
                title="Nichts offen"
              />
            ) : (
              <div className="habit-card-list">
                {openHabits.map((habit) => (
                  <HabitTodayCard
                    busy={busyHabitId === habit.id}
                    entries={entriesFor(habit)}
                    habit={habit}
                    key={habit.id}
                    onArchive={(selected) => void archiveHabit(selected)}
                    onCheckIn={(selected, status) =>
                      void checkIn(selected, status, today)
                    }
                    onEdit={(selected) => setEditor({ habit: selected })}
                    onReopen={(selected) => void reopen(selected, today)}
                    today={today}
                  />
                ))}
              </div>
            )}

            {settledHabits.length > 0 ? (
              <>
                <h2>Heute schon erfasst</h2>
                <div className="habit-card-list">
                  {settledHabits.map((habit) => (
                    <HabitTodayCard
                      busy={busyHabitId === habit.id}
                      entries={entriesFor(habit)}
                      habit={habit}
                      key={habit.id}
                      onArchive={(selected) => void archiveHabit(selected)}
                      onCheckIn={(selected, status) =>
                        void checkIn(selected, status, today)
                      }
                      onEdit={(selected) => setEditor({ habit: selected })}
                      onReopen={(selected) => void reopen(selected, today)}
                      today={today}
                    />
                  ))}
                </div>
              </>
            ) : null}

            <HabitStateList
              description="Diese Gewohnheiten sind heute laut Rhythmus nicht geplant."
              habits={restingHabits}
              onEdit={(habit) => setEditor({ habit })}
              title="Heute nicht fällig"
            />
            <HabitStateList
              description="Diese Gewohnheiten starten erst an ihrem Startdatum."
              detail={(habit) =>
                `Start am ${formatCalendarDay(habit.startDate)}`
              }
              habits={upcomingHabits}
              onEdit={(habit) => setEditor({ habit })}
              title="Startet später"
            />
            <HabitStateList
              description="Diese Gewohnheiten sind seit ihrem Enddatum pausiert. Die erfassten Check-ins bleiben erhalten."
              detail={(habit) =>
                habit.endDate
                  ? `Pausiert seit ${formatCalendarDay(habit.endDate)}`
                  : "Pausiert"
              }
              habits={pausedHabits}
              onEdit={(habit) => setEditor({ habit })}
              title="Pausiert"
            />
          </>
        ) : activeView === "week" ? (
          <>
            <h2>
              Woche vom {formatCalendarDay(weekStart)} bis{" "}
              {formatCalendarDay(weekEnd)}
            </h2>
            <div className="habit-week-nav">
              <Button
                onClick={() => setWeekOffset((offset) => offset - 1)}
                variant="secondary"
              >
                Vorherige Woche
              </Button>
              <Button
                disabled={weekOffset >= 0}
                onClick={() =>
                  setWeekOffset((offset) => Math.min(0, offset + 1))
                }
                variant="secondary"
              >
                Nächste Woche
              </Button>
            </div>
            <p className="habit-view-hint">
              Die laufende Woche ist die letzte auswertbare Woche. Check-ins
              sind bis einschließlich heute möglich.
            </p>
            {weekHabits.length === 0 ? (
              <EmptyState
                description="In dieser Woche war keine Gewohnheit aktiv."
                title="Keine Einträge"
              />
            ) : (
              <HabitWeekGrid
                busyHabitId={busyHabitId}
                days={weekDays}
                entriesByHabit={entriesByHabit}
                habits={weekHabits}
                onToggle={toggleWeekDay}
                today={today}
              />
            )}
          </>
        ) : activeView === "progress" ? (
          <>
            <h2>Fortschritt</h2>
            <Select
              hint="Der Zeitraum beginnt frühestens am Startdatum der Gewohnheit."
              label="Zeitraum"
              onChange={(event) =>
                setProgressPeriod(
                  event.currentTarget.value as HabitProgressPeriod,
                )
              }
              value={progressPeriod}
            >
              {progressPeriods.map((period) => (
                <option key={period} value={period}>
                  {habitProgressPeriodLabels[period]}
                </option>
              ))}
            </Select>
            <p className="habit-view-hint">
              Serien und Quote werden aus dem gespeicherten Rhythmus und den
              erfassten Check-ins berechnet. Frühere Rhythmen werden nicht
              historisiert: Nach einer Änderung nutzt auch die Rückschau den
              aktuellen Rhythmus, während die erfassten Check-ins unverändert
              bleiben.
            </p>
            {trackedHabits.length === 0 ? (
              <EmptyState
                description="Sobald du eine Gewohnheit anlegst, entsteht hier die Auswertung."
                title="Noch keine Auswertung"
              />
            ) : (
              <div className="habit-card-list">
                {trackedHabits.map((habit) => (
                  <HabitProgressCard
                    entries={entriesFor(habit)}
                    habit={habit}
                    key={habit.id}
                    period={progressPeriod}
                    today={today}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <h2>Archiv</h2>
            <p className="habit-view-hint">
              Archivierte Gewohnheiten erscheinen nicht mehr im Tagesablauf.
              Ihre Check-ins bleiben als Historie gespeichert.
            </p>
            {archivedHabits.length === 0 ? (
              <EmptyState
                description="Hier sammeln sich Gewohnheiten, die du gerade nicht begleiten möchtest."
                title="Nichts archiviert"
              />
            ) : (
              <ul className="habit-plain-list">
                {archivedHabits.map((habit) => (
                  <li key={habit.id}>
                    <div>
                      <h3>{habit.name}</h3>
                      <p>{getHabitScheduleLabel(habit.schedule)}</p>
                      <p>
                        {entriesFor(habit).length} erfasste Check-ins bleiben
                        gespeichert.
                      </p>
                    </div>
                    <Button
                      aria-label={`„${habit.name}“ wiederherstellen`}
                      disabled={busyHabitId === habit.id}
                      onClick={() => void restoreHabit(habit)}
                      variant="secondary"
                    >
                      Wiederherstellen
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {notice ? (
        <div className="habit-toast-region">
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

      {editor ? (
        <HabitEditor
          habit={editor.habit}
          isSaving={isSaving}
          key={editor.habit?.id ?? "new"}
          onClose={() => setEditor(undefined)}
          onSave={saveHabit}
          today={today}
        />
      ) : null}
    </section>
  );
}

type HabitStateListProps = {
  description: string;
  detail?: (habit: Habit) => string;
  habits: Habit[];
  onEdit: (habit: Habit) => void;
  title: string;
};

function HabitStateList({
  description,
  detail,
  habits,
  onEdit,
  title,
}: HabitStateListProps) {
  if (habits.length === 0) return null;
  return (
    <section className="habit-state-list">
      <h2>{title}</h2>
      <p className="habit-view-hint">{description}</p>
      <ul className="habit-plain-list">
        {habits.map((habit) => (
          <li key={habit.id}>
            <div>
              <h3>{habit.name}</h3>
              <p>{getHabitScheduleLabel(habit.schedule)}</p>
              {detail ? <p>{detail(habit)}</p> : null}
            </div>
            <Button
              aria-label={`„${habit.name}“ bearbeiten`}
              onClick={() => onEdit(habit)}
              variant="secondary"
            >
              Bearbeiten
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function readHabitSnapshot(service: HabitService): Promise<{
  entries: Map<string, HabitEntry[]>;
  habits: Habit[];
}> {
  const habits = await service.list({ includeArchived: true });
  const entries = await Promise.all(
    habits.map((habit) => service.listEntries(habit.id)),
  );
  return {
    entries: new Map(habits.map((habit, index) => [habit.id, entries[index]])),
    habits,
  };
}

export function Component() {
  return <HabitsPage />;
}

function systemNow() {
  return new Date();
}
