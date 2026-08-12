import { useCallback, useEffect, useMemo, useState } from "react";

import {
  useTimeZone,
  useWeekStartsOn,
} from "../../../app/settings/settings-context";
import {
  Button,
  EmptyState,
  PageToolbar,
  RankedBarList,
  Select,
  Toast,
} from "../../../components/ui";
import {
  addCalendarMonths,
  calendarDayForInstant,
  getCalendarMonth,
  type WeekStartsOn,
} from "../../../lib/dates/calendar-days";
import type { CalendarDay } from "../../../lib/dates/date-values";
import {
  personalOsGoalLinkService,
  type GoalLinkService,
  type GoalOption,
} from "../../goals/link-service";
import { HabitEditor } from "../components/HabitEditor";
import { HabitMonthGrid } from "../components/HabitMonthGrid";
import { calculateHabitStreak } from "../metrics";
import { buildHabitMonthView } from "../month-view";
import type {
  Habit,
  HabitDetails,
  HabitEntry,
  HabitEntryStatus,
} from "../model";
import { personalOsHabitService, type HabitService } from "../service";
import {
  formatCalendarDay,
  formatCalendarMonth,
  formatHabitRate,
  formatHabitStreak,
  getHabitActivityState,
  getHabitDayState,
  getHabitScheduleLabel,
} from "../view-model";
import "./habits-page.css";

type HabitVisibility = "active" | "archived";

type HabitUndoAction = {
  habitId: string;
  message: string;
  run: () => Promise<unknown>;
};

export type HabitsPageProps = {
  goalLinks?: GoalLinkService;
  now?: () => Date;
  service?: HabitService;
  timeZone?: string;
  weekStartsOn?: WeekStartsOn;
};

export function HabitsPage({
  goalLinks = personalOsGoalLinkService,
  now = systemNow,
  service = personalOsHabitService,
  timeZone: timeZoneOverride,
  weekStartsOn: weekStartsOnOverride,
}: HabitsPageProps) {
  const timeZone = useTimeZone(timeZoneOverride);
  const weekStartsOn = useWeekStartsOn(weekStartsOnOverride);
  const [goalOptions, setGoalOptions] = useState<GoalOption[]>([]);
  const [goalTitles, setGoalTitles] = useState<ReadonlyMap<string, string>>(
    new Map(),
  );
  const [busyHabitId, setBusyHabitId] = useState<string>();
  const [editor, setEditor] = useState<{ habit?: Habit }>();
  const [entriesByHabit, setEntriesByHabit] = useState<
    ReadonlyMap<string, HabitEntry[]>
  >(new Map());
  const [error, setError] = useState<string>();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [notice, setNotice] = useState<string>();
  const [undo, setUndo] = useState<HabitUndoAction>();
  const [visibility, setVisibility] = useState<HabitVisibility>("active");

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
    void readHabitSnapshot(service).then(
      (snapshot) => {
        if (!isCurrent) return;
        setHabits(snapshot.habits);
        setEntriesByHabit(snapshot.entries);
        setIsLoading(false);
      },
      () => {
        if (!isCurrent) return;
        setError("Die Routinen konnten nicht geladen werden.");
        setIsLoading(false);
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

  const upcomingHabits = habits.filter(
    (habit) => getHabitActivityState(habit, today) === "upcoming",
  );
  const pausedHabits = habits.filter(
    (habit) => getHabitActivityState(habit, today) === "paused",
  );
  const archivedHabits = habits.filter(
    (habit) => habit.archivedAt !== undefined,
  );
  const trackedHabits = habits.filter(
    (habit) => habit.archivedAt === undefined,
  );

  const month = addCalendarMonths(getCalendarMonth(today), monthOffset);
  const monthView = useMemo(
    () =>
      buildHabitMonthView({
        entriesByHabit,
        habits: visibility === "archived" ? archivedHabits : habits,
        includeArchived: visibility === "archived",
        month,
        today,
        weekStartsOn,
      }),
    [
      archivedHabits,
      entriesByHabit,
      habits,
      month,
      today,
      visibility,
      weekStartsOn,
    ],
  );

  const streaks = useMemo(
    () =>
      new Map(
        trackedHabits.map((habit) => {
          const streak = calculateHabitStreak(habit, entriesFor(habit), today);
          return [
            habit.id,
            formatHabitStreak(streak.unit, streak.current),
          ] as const;
        }),
      ),
    [entriesFor, today, trackedHabits],
  );

  const streakRanking = trackedHabits
    .map((habit) => {
      const streak = calculateHabitStreak(habit, entriesFor(habit), today);
      return {
        id: habit.id,
        label: habit.name,
        value: streak.current,
        valueText: formatHabitStreak(streak.unit, streak.current),
      };
    })
    .filter((entry) => entry.value > 0)
    .sort((first, second) => second.value - first.value);

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
      "Die Routine wurde archiviert. Die Check-ins bleiben erhalten.",
      "Die Routine konnte nicht archiviert werden.",
    );
    if (archived) {
      setUndo({
        habitId: habit.id,
        message: "Die Archivierung wurde rückgängig gemacht.",
        run: () => service.restore(habit.id),
      });
    }
  }

  async function restoreHabit(habit: Habit) {
    await runHabitAction(
      habit,
      () => service.restore(habit.id),
      "Die Routine ist wieder aktiv.",
      "Die Routine konnte nicht wiederhergestellt werden.",
    );
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

  async function saveHabit(details: HabitDetails) {
    const habit = editor?.habit;
    setIsSaving(true);
    try {
      if (habit) {
        return await runHabitAction(
          habit,
          () => service.updateDetails(habit.id, details),
          "Gespeichert. Der Rhythmus gilt ab heute; erfasste Check-ins bleiben unverändert.",
          "Die Routine konnte nicht gespeichert werden.",
        );
      }
      setError(undefined);
      setUndo(undefined);
      await service.create(details);
      await load();
      setNotice("Die Routine wurde angelegt.");
      return true;
    } catch {
      setError("Die Routine konnte nicht gespeichert werden.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  function toggleMonthDay(habit: Habit, day: CalendarDay, isDone: boolean) {
    void (isDone ? reopen(habit, day) : checkIn(habit, "done", day));
  }

  function toggleTodaySkip(habit: Habit) {
    const state = getHabitDayState(habit, entriesFor(habit), today);
    void checkIn(habit, state === "skipped" ? "done" : "skipped", today);
  }

  return (
    <section
      aria-labelledby="page-title"
      className="route-page habits-page"
      data-surface="work"
    >
      <PageToolbar
        actions={
          <>
            <Button
              aria-label="Vorheriger Monat"
              onClick={() => setMonthOffset((offset) => offset - 1)}
              variant="secondary"
            >
              ‹
            </Button>
            <Button
              disabled={monthOffset === 0}
              onClick={() => setMonthOffset(0)}
              variant="secondary"
            >
              Heute
            </Button>
            <Button
              aria-label="Nächster Monat"
              disabled={monthOffset >= 0}
              onClick={() =>
                setMonthOffset((offset) => Math.min(0, offset + 1))
              }
              variant="secondary"
            >
              ›
            </Button>
            <Button onClick={() => setEditor({})}>Neue Routine</Button>
          </>
        }
        description="Check-ins, Zeitverlauf und Fortschritt in einer zusammenhängenden Arbeitsfläche."
        eyebrow="Routinen"
        period={formatCalendarMonth(month)}
        surface="work"
        title="Routinen"
      />

      {error ? (
        <p className="page-alert habit-page-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="habit-work-controls">
        <Select
          hint={
            visibility === "active"
              ? `${trackedHabits.length} aktive Routinen; ${archivedHabits.length} archiviert.`
              : "Archivierte Routinen bleiben mit ihrer Check-in-Historie erhalten."
          }
          label="Routinen anzeigen"
          onChange={(event) =>
            setVisibility(event.currentTarget.value as HabitVisibility)
          }
          value={visibility}
        >
          <option value="active">Aktive Routinen</option>
          <option value="archived">Archiv</option>
        </Select>

        {visibility === "active" && monthView.summary.counted > 0 ? (
          <p className="habit-month-summary" role="status">
            <strong>{formatHabitRate(monthView.summary.rate)}</strong>
            <span>
              {monthView.summary.done} von {monthView.summary.counted} im
              sichtbaren Zeitraum erledigt
              {monthView.summary.skipped > 0
                ? ` · ${monthView.summary.skipped} übersprungen`
                : ""}
            </span>
          </p>
        ) : null}
      </div>

      <div aria-live="polite" className="habit-workspace">
        {isLoading ? (
          <p className="habit-view-status" role="status">
            Routinen werden geladen …
          </p>
        ) : monthView.rows.length === 0 ? (
          <EmptyState
            action={
              visibility === "active" ? (
                <Button onClick={() => setEditor({})}>Routine anlegen</Button>
              ) : undefined
            }
            description={
              visibility === "archived"
                ? "Archivierte Routinen dieses Monats erscheinen hier und können wiederhergestellt werden."
                : trackedHabits.length === 0
                  ? "Lege eine Routine an, um deinen Tagesrhythmus zu begleiten."
                  : "In diesem Monat war keine aktive Routine eingeplant."
            }
            headingLevel={2}
            title={
              visibility === "archived"
                ? "Nichts archiviert"
                : "Keine Routine im Zeitraum"
            }
          />
        ) : (
          <div className="ui-dense-panel habit-month-panel">
            <HabitMonthGrid
              busyHabitId={busyHabitId}
              goalTitles={goalTitles}
              onArchive={(habit) => void archiveHabit(habit)}
              onEdit={(habit) => setEditor({ habit })}
              onRestore={(habit) => void restoreHabit(habit)}
              onSkipToday={toggleTodaySkip}
              onToggle={toggleMonthDay}
              streaks={streaks}
              today={today}
              view={monthView}
            />
          </div>
        )}
      </div>

      {visibility === "active" &&
      (upcomingHabits.length > 0 || pausedHabits.length > 0) ? (
        <details className="habit-management">
          <summary>Weitere Routinen verwalten</summary>
          <HabitStateList
            description="Diese Routinen starten erst an ihrem Startdatum."
            detail={(habit) => `Start am ${formatCalendarDay(habit.startDate)}`}
            habits={upcomingHabits}
            onEdit={(habit) => setEditor({ habit })}
            title="Startet später"
          />
          <HabitStateList
            description="Diese Routinen sind seit ihrem Enddatum pausiert. Ihre Check-ins bleiben erhalten."
            detail={(habit) =>
              habit.endDate
                ? `Pausiert seit ${formatCalendarDay(habit.endDate)}`
                : "Pausiert"
            }
            habits={pausedHabits}
            onEdit={(habit) => setEditor({ habit })}
            title="Pausiert"
          />
        </details>
      ) : null}

      {visibility === "active" && trackedHabits.length > 0 ? (
        <details
          className="habit-period-analysis"
          onToggle={(event) => setIsAnalysisOpen(event.currentTarget.open)}
          open={isAnalysisOpen}
        >
          <summary>Auswertung des sichtbaren Zeitraums</summary>
          {isAnalysisOpen ? (
            <RankedBarList
              caption="Orientierung, keine Rangordnung. Serien verwenden weiterhin den gespeicherten Rhythmus."
              emptyMessage="Noch keine laufende Serie."
              items={streakRanking}
              label="Aktive Serien"
              tone={2}
            />
          ) : null}
        </details>
      ) : null}

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
          goalOptions={goalOptions}
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
  const [habits, entries] = await Promise.all([
    service.list({ includeArchived: true }),
    service.listEntriesByHabit(),
  ]);
  return { entries, habits };
}

export function Component() {
  return <HabitsPage />;
}

function systemNow() {
  return new Date();
}
