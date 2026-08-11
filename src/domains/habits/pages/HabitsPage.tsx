import { useCallback, useEffect, useMemo, useState } from "react";

import {
  useTimeZone,
  useWeekStartsOn,
} from "../../../app/settings/settings-context";
import {
  Button,
  Chart,
  EmptyState,
  RankedBarList,
  Select,
  Toast,
  ViewTabs,
  viewTabId,
} from "../../../components/ui";
import {
  addCalendarDays,
  addCalendarMonths,
  calendarDayForInstant,
  enumerateCalendarDays,
  getCalendarMonth,
  getIsoWeekBounds,
  type WeekStartsOn,
} from "../../../lib/dates/calendar-days";
import type { CalendarDay } from "../../../lib/dates/date-values";
import {
  personalOsGoalLinkService,
  type GoalLinkService,
  type GoalOption,
} from "../../goals/link-service";
import { HabitEditor } from "../components/HabitEditor";
import { calculateHabitStreak } from "../metrics";
import { HabitMonthGrid } from "../components/HabitMonthGrid";
import { HabitProgressCard } from "../components/HabitProgressCard";
import { HabitTodayCard } from "../components/HabitTodayCard";
import { HabitWeekGrid } from "../components/HabitWeekGrid";
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
  formatCalendarDayShort,
  formatCalendarMonth,
  formatHabitRate,
  formatHabitStreak,
  getHabitActivityState,
  getHabitDayState,
  getHabitScheduleLabel,
  habitProgressPeriodLabels,
  type HabitDayState,
  type HabitProgressPeriod,
} from "../view-model";
import "./habits-page.css";

type HabitsView = "archive" | "month" | "progress" | "today" | "week";

type HabitUndoAction = {
  habitId: string;
  message: string;
  run: () => Promise<unknown>;
};

const habitViews: Array<{ id: HabitsView; label: string }> = [
  { id: "today", label: "Heute" },
  { id: "week", label: "Woche" },
  { id: "month", label: "Monat" },
  { id: "progress", label: "Fortschritt" },
  { id: "archive", label: "Archiv" },
];

const progressPeriods: HabitProgressPeriod[] = [
  "last7Days",
  "last28Days",
  "sinceStart",
];

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
  const [activeView, setActiveView] = useState<HabitsView>("today");
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [progressPeriod, setProgressPeriod] =
    useState<HabitProgressPeriod>("last28Days");
  const [undo, setUndo] = useState<HabitUndoAction>();
  const [monthOffset, setMonthOffset] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [isWeekAnalysisOpen, setIsWeekAnalysisOpen] = useState(false);

  const today = useMemo(
    () => calendarDayForInstant(now(), timeZone),
    [now, timeZone],
  );

  const load = useCallback(async () => {
    const snapshot = await readHabitSnapshot(service);
    setHabits(snapshot.habits);
    setEntriesByHabit(snapshot.entries);
  }, [service]);

  // Die Zielauswahl ist optional; ohne sie bleibt die Seite voll nutzbar.
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
        if (isCurrent) {
          setError("Die Routinen konnten nicht geladen werden.");
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

  const month = addCalendarMonths(getCalendarMonth(today), monthOffset);
  const monthView = useMemo(
    () =>
      buildHabitMonthView({
        entriesByHabit,
        habits,
        month,
        today,
        weekStartsOn,
      }),
    [entriesByHabit, habits, month, today, weekStartsOn],
  );

  // Der Wochenverlauf zählt nur, was an dem Tag tatsächlich geplant war.
  const weekCourse = weekDays.map((day) => {
    let done = 0;
    let due = 0;
    for (const habit of weekHabits) {
      const state = getHabitDayState(habit, entriesFor(habit), day);
      if (state === "not-due") continue;
      due += 1;
      if (state === "done") done += 1;
    }
    return { day, done, due };
  });
  const weekHasPlannedDays = weekCourse.some((entry) => entry.due > 0);

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

  const viewCounts: Record<HabitsView, number> = {
    archive: archivedHabits.length,
    month: monthView.rows.length,
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
      "Die Routine ist wieder aktiv.",
      "Die Routine konnte nicht wiederhergestellt werden.",
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

  function toggleWeekDay(habit: Habit, day: CalendarDay, state: HabitDayState) {
    void (state === "done" ? reopen(habit, day) : checkIn(habit, "done", day));
  }

  function toggleMonthDay(habit: Habit, day: CalendarDay, isDone: boolean) {
    void (isDone ? reopen(habit, day) : checkIn(habit, "done", day));
  }

  return (
    <section aria-labelledby="page-title" className="route-page habits-page">
      <header className="page-header">
        <div className="page-header-copy">
          <p className="page-eyebrow">Routinen</p>
          <h1 id="page-title">Routinen</h1>
          <p className="page-description">
            Begleite wiederkehrende Routinen ohne Druck oder versteckte
            Bewertung.
          </p>
        </div>
      </header>

      <div className="habit-page-actions">
        <Button onClick={() => setEditor({})}>Neue Routine</Button>
      </div>

      {error ? (
        <p className="page-alert habit-page-error" role="alert">
          {error}
        </p>
      ) : null}

      <ViewTabs
        activeId={activeView}
        className="habit-view-tabs"
        idPrefix="habit-view"
        label="Routinenansicht"
        onChange={setActiveView}
        panelId="habit-view-panel"
        tabs={habitViews.map((view) => ({
          count: {
            label: `${viewCounts[view.id]} Routinen`,
            value: viewCounts[view.id],
          },
          id: view.id,
          label: view.label,
        }))}
      />

      <div
        aria-labelledby={viewTabId("habit-view", activeView)}
        aria-live="polite"
        className="habit-view-panel"
        id="habit-view-panel"
        role="tabpanel"
      >
        {isLoading ? (
          <p className="habit-view-status" role="status">
            Routinen werden geladen …
          </p>
        ) : activeView === "today" ? (
          <>
            <h2>Heute fällig</h2>
            {openHabits.length === 0 ? (
              <EmptyState
                description={
                  activeHabits.length === 0
                    ? "Lege eine Routine an, um deinen Tagesrhythmus zu begleiten."
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
              description="Diese Routinen sind heute laut Rhythmus nicht geplant."
              habits={restingHabits}
              onEdit={(habit) => setEditor({ habit })}
              title="Heute nicht fällig"
            />
            <HabitStateList
              description="Diese Routinen starten erst an ihrem Startdatum."
              detail={(habit) =>
                `Start am ${formatCalendarDay(habit.startDate)}`
              }
              habits={upcomingHabits}
              onEdit={(habit) => setEditor({ habit })}
              title="Startet später"
            />
            <HabitStateList
              description="Diese Routinen sind seit ihrem Enddatum pausiert. Die erfassten Check-ins bleiben erhalten."
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
              Check-ins sind bis einschließlich heute möglich.
            </p>
            {weekHabits.length === 0 ? (
              <EmptyState
                description="In dieser Woche war keine Routine aktiv."
                title="Keine Einträge"
              />
            ) : (
              <>
                {/*
                  Erfassen vor Auswerten, Issue #121. Vorher standen Diagramm,
                  Tageswerte und Serien vor dem Raster; auf Mobil lag das
                  einzige interaktive Element der Ansicht damit weit unter dem
                  ersten Bildschirm.
                */}
                {weekHasPlannedDays ? (
                  <ul className="habit-week-course">
                    {weekCourse.map((entry) => (
                      <li key={entry.day}>
                        <span>{formatCalendarDayShort(entry.day)}</span>
                        <span>
                          {entry.done} von {entry.due}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="ui-dense-panel habit-week-panel">
                  <HabitWeekGrid
                    busyHabitId={busyHabitId}
                    days={weekDays}
                    entriesByHabit={entriesByHabit}
                    habits={weekHabits}
                    onToggle={toggleWeekDay}
                    today={today}
                  />
                </div>

                {/*
                  Das Diagramm wird erst gerendert, wenn die Auswertung offen
                  ist. Nur so bleibt die Wochenansicht frei von der
                  Diagrammbibliothek, solange niemand sie sehen will —
                  `React.lazy` allein lädt sie, sobald die Fläche im Baum steht.
                */}
                <details
                  className="habit-week-analysis"
                  onToggle={(event) =>
                    setIsWeekAnalysisOpen(event.currentTarget.open)
                  }
                  open={isWeekAnalysisOpen}
                >
                  <summary className="habit-week-analysis-summary">
                    Auswertung dieser Woche
                  </summary>
                  {isWeekAnalysisOpen ? (
                    <div className="habit-week-chart">
                      <Chart
                        categories={weekCourse.map((entry) =>
                          formatCalendarDayShort(entry.day),
                        )}
                        emptyMessage="In dieser Woche war an keinem Tag etwas geplant."
                        period={`${formatCalendarDay(weekStart)} bis ${formatCalendarDay(weekEnd)}`}
                        series={
                          weekHasPlannedDays
                            ? [
                                {
                                  id: "done",
                                  label: "Erledigt",
                                  tone: 1,
                                  values: weekCourse.map((entry) => entry.done),
                                },
                                {
                                  id: "due",
                                  label: "Geplant",
                                  tone: 2,
                                  values: weekCourse.map((entry) => entry.due),
                                },
                              ]
                            : []
                        }
                        source={`Grundlage: ${weekHabits.length} in dieser Woche aktive Routinen. Übersprungene Tage zählen nicht als erledigt.`}
                        title="Wochenverlauf"
                      />
                    </div>
                  ) : null}
                </details>

                {/*
                  Die Serien bleiben außerhalb der Ausklappfläche: Sie sind
                  Text und Balken aus vorhandenen Werten und kosten nichts
                  nachzuladen.
                */}
                <RankedBarList
                  caption="Orientierung, keine Rangordnung."
                  emptyMessage="Noch keine laufende Serie."
                  items={streakRanking}
                  label="Aktive Serien"
                  tone={2}
                />
              </>
            )}
          </>
        ) : activeView === "month" ? (
          <>
            <h2>{formatCalendarMonth(month)}</h2>
            <div className="habit-week-nav">
              <Button
                onClick={() => setMonthOffset((offset) => offset - 1)}
                variant="secondary"
              >
                Vorheriger Monat
              </Button>
              <Button
                disabled={monthOffset >= 0}
                onClick={() =>
                  setMonthOffset((offset) => Math.min(0, offset + 1))
                }
                variant="secondary"
              >
                Nächster Monat
              </Button>
            </div>
            <p className="habit-view-hint">
              Check-ins sind bis einschließlich heute möglich.{" "}
              {monthView.countedTo === undefined
                ? "Der Monat liegt noch vor dir; eine Quote entsteht ab dem ersten vergangenen Tag."
                : `Die Quoten zählen vom ${formatCalendarDay(monthView.from)} bis ${formatCalendarDay(monthView.countedTo)}; zukünftige Tage bleiben außen vor. Der Zeitraum je Routine beginnt frühestens an ihrem Startdatum.`}
            </p>
            {monthView.rows.length === 0 ? (
              <EmptyState
                description="In diesem Monat war keine Routine aktiv."
                title="Keine Einträge"
              />
            ) : (
              <>
                {/*
                  Die Zusammenfassung ist Text aus vorhandenen Werten und steht
                  deshalb vor dem Raster. Ein Diagramm gibt es hier nicht: Das
                  Monatsraster ist die Ansicht, nicht ihre Auswertung.
                */}
                <p className="habit-month-summary">
                  {monthView.summary.counted === 0
                    ? "Für diesen Zeitraum gibt es noch keine zählenden Einheiten."
                    : `${monthView.summary.done} von ${monthView.summary.counted} zählenden Einheiten erledigt · ${formatHabitRate(monthView.summary.rate)}${
                        monthView.summary.skipped > 0
                          ? ` · ${monthView.summary.skipped} übersprungen`
                          : ""
                      }`}
                </p>

                <div className="ui-dense-panel habit-month-panel">
                  <HabitMonthGrid
                    busyHabitId={busyHabitId}
                    onToggle={toggleMonthDay}
                    view={monthView}
                  />
                </div>
              </>
            )}
          </>
        ) : activeView === "progress" ? (
          <>
            <h2>Fortschritt</h2>
            <Select
              hint="Der Zeitraum beginnt frühestens am Startdatum der Routine."
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
                description="Sobald du eine Routine anlegst, entsteht hier die Auswertung."
                title="Noch keine Auswertung"
              />
            ) : (
              <div className="habit-card-list">
                {trackedHabits.map((habit) => (
                  <HabitProgressCard
                    entries={entriesFor(habit)}
                    goalTitle={
                      habit.goalId === undefined
                        ? undefined
                        : goalTitles.get(habit.goalId)
                    }
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
              Archivierte Routinen erscheinen nicht mehr im Tagesablauf. Ihre
              Check-ins bleiben als Historie gespeichert.
            </p>
            {archivedHabits.length === 0 ? (
              <EmptyState
                description="Hier sammeln sich Routinen, die du gerade nicht begleiten möchtest."
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
  // Eine Abfrage für alle Check-ins statt einer je Routine.
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
