import { useEffect, useRef, type MouseEvent } from "react";

import {
  Button,
  TrackerCell,
  type TrackerCellState,
} from "../../../components/ui";
import type { CalendarDay } from "../../../lib/dates/date-values";
import {
  habitMonthActionLabels,
  habitMonthStateLabels,
  type HabitMonthCellState,
  type HabitMonthView,
} from "../month-view";
import type { Habit } from "../model";
import {
  formatCalendarDayLong,
  formatCalendarDayNumber,
  formatCalendarDayShort,
  formatCalendarWeekday,
  formatHabitRate,
} from "../view-model";

type HabitMonthGridProps = {
  busyHabitId?: string;
  goalTitles?: ReadonlyMap<string, string>;
  onArchive: (habit: Habit) => void;
  onEdit: (habit: Habit) => void;
  onRestore: (habit: Habit) => void;
  onSkipToday: (habit: Habit) => void;
  onToggle: (habit: Habit, day: CalendarDay, isDone: boolean) => void;
  streaks?: ReadonlyMap<string, string>;
  today: CalendarDay;
  view: HabitMonthView;
};

function closeRowMenu(event: MouseEvent<HTMLButtonElement>) {
  event.currentTarget.closest("details")?.removeAttribute("open");
}

const trackerStates: Record<HabitMonthCellState, TrackerCellState> = {
  done: "done",
  future: "none",
  "not-due": "none",
  open: "open",
  outside: "outside",
  skipped: "skipped",
};

export function HabitMonthGrid({
  busyHabitId,
  goalTitles = new Map(),
  onArchive,
  onEdit,
  onRestore,
  onSkipToday,
  onToggle,
  streaks = new Map(),
  today,
  view,
}: HabitMonthGridProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  /*
   * Der Monatsraum bleibt eine Oberfläche. Beim Einstieg rückt deshalb die
   * heutige Spalte in den sichtbaren Ausschnitt, statt eine zweite
   * „Heute“-Ansicht zu öffnen. Frühere Monate beginnen am Monatsanfang.
   */
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const todayHeader = scroller.querySelector<HTMLElement>(
      'thead [data-today="true"]',
    );
    if (!todayHeader) {
      scroller.scrollLeft = 0;
      return;
    }
    scroller.scrollLeft = Math.max(
      0,
      todayHeader.offsetLeft -
        scroller.clientWidth / 2 +
        todayHeader.offsetWidth / 2,
    );
  }, [view.month]);

  return (
    <>
      <div
        aria-label="Routinen-Tracker, horizontal scrollbar"
        className="ui-tracker-scroller habit-month-scroll"
        ref={scrollerRef}
        role="region"
        tabIndex={0}
      >
        <table className="ui-tracker-grid habit-month-table">
          <caption className="visually-hidden">
            Routinen stehen in Zeilen, reale Kalendertage in Spalten. Erledigt,
            offen, übersprungen, nicht fällig, später fällig und außerhalb des
            Zeitraums werden als Zeichen und Text genannt.
          </caption>
          <thead>
            <tr>
              <td className="habit-month-corner" />
              {view.weeks.map((week, index) => (
                <th
                  className={`habit-month-week-tone-${(index % 6) + 1}`}
                  colSpan={week.days.length}
                  data-week-start="true"
                  key={week.start}
                  scope="colgroup"
                >
                  <span aria-hidden="true">
                    Woche ab {formatCalendarDayShort(week.start)}
                  </span>
                  <span className="visually-hidden">
                    Woche ab {formatCalendarDayLong(week.start)}
                  </span>
                </th>
              ))}
              <td className="habit-month-summary-corner" />
            </tr>
            <tr>
              <th scope="col">Routine</th>
              {view.days.map((day) => (
                <th
                  data-today={day.isToday}
                  data-week-start={day.isWeekStart}
                  key={day.day}
                  scope="col"
                >
                  <span aria-hidden="true">
                    {formatCalendarWeekday(day.day)}
                  </span>
                  <span aria-hidden="true">
                    {formatCalendarDayNumber(day.day)}
                  </span>
                  <span className="visually-hidden">
                    {formatCalendarDayLong(day.day)}
                    {day.isToday ? ", heute" : ""}
                  </span>
                </th>
              ))}
              <th className="habit-month-summary-heading" scope="col">
                Fortschritt
              </th>
            </tr>
          </thead>
          <tbody>
            {view.rows.map((row) => {
              const isArchived = row.habit.archivedAt !== undefined;
              const todayCell = row.cells.find((cell) => cell.day === today);
              const goalTitle = row.habit.goalId
                ? goalTitles.get(row.habit.goalId)
                : undefined;
              return (
                <tr key={row.habit.id}>
                  <th scope="row">
                    <div className="habit-month-row-heading">
                      <span className="habit-month-row-name">
                        {row.habit.name}
                      </span>
                      <details className="habit-month-row-menu">
                        <summary
                          aria-label={`„${row.habit.name}“ verwalten`}
                          role="button"
                        >
                          •••
                        </summary>
                        <div className="habit-month-row-menu-actions">
                          {isArchived ? (
                            <Button
                              disabled={busyHabitId === row.habit.id}
                              onClick={(event) => {
                                closeRowMenu(event);
                                onRestore(row.habit);
                              }}
                              variant="ghost"
                            >
                              Wiederherstellen
                            </Button>
                          ) : (
                            <>
                              <Button
                                onClick={(event) => {
                                  closeRowMenu(event);
                                  onEdit(row.habit);
                                }}
                                variant="ghost"
                              >
                                Bearbeiten
                              </Button>
                              {todayCell?.interactive &&
                              (todayCell.state === "open" ||
                                todayCell.state === "skipped") ? (
                                <Button
                                  disabled={busyHabitId === row.habit.id}
                                  onClick={(event) => {
                                    closeRowMenu(event);
                                    onSkipToday(row.habit);
                                  }}
                                  variant="ghost"
                                >
                                  {todayCell.state === "skipped"
                                    ? "Heute doch erledigen"
                                    : "Heute überspringen"}
                                </Button>
                              ) : null}
                              <Button
                                disabled={busyHabitId === row.habit.id}
                                onClick={(event) => {
                                  closeRowMenu(event);
                                  onArchive(row.habit);
                                }}
                                variant="ghost"
                              >
                                Archivieren
                              </Button>
                            </>
                          )}
                        </div>
                      </details>
                    </div>
                  </th>
                  {row.cells.map((cell, index) => (
                    <td
                      data-week-start={view.days[index].isWeekStart}
                      key={cell.day}
                    >
                      <TrackerCell
                        actionLabel={
                          cell.interactive
                            ? habitMonthActionLabels[cell.state]
                            : undefined
                        }
                        dayLabel={`${row.habit.name} am ${formatCalendarDayLong(cell.day)}`}
                        disabled={
                          cell.interactive
                            ? busyHabitId === row.habit.id
                            : undefined
                        }
                        onClick={
                          cell.interactive
                            ? () =>
                                onToggle(
                                  row.habit,
                                  cell.day,
                                  cell.state === "done",
                                )
                            : undefined
                        }
                        state={trackerStates[cell.state]}
                        stateLabel={habitMonthStateLabels[cell.state]}
                      />
                    </td>
                  ))}
                  <td className="habit-month-row-summary">
                    <strong>
                      {row.fulfillment && row.fulfillment.counted > 0
                        ? formatHabitRate(row.fulfillment.rate)
                        : formatHabitRate(null)}
                    </strong>
                    {row.fulfillment && row.fulfillment.counted > 0 ? (
                      <span>
                        {row.fulfillment.done} von {row.fulfillment.counted}
                      </span>
                    ) : null}
                    {!isArchived && streaks.get(row.habit.id) ? (
                      <span>Serie: {streaks.get(row.habit.id)}</span>
                    ) : null}
                    {goalTitle ? <span>Ziel: {goalTitle}</span> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Erledigt je Tag</th>
              {view.days.map((day) => (
                <td data-week-start={day.isWeekStart} key={day.day}>
                  <span aria-hidden="true" className="habit-month-day-total">
                    {day.counted === 0 ? "·" : `${day.done}/${day.counted}`}
                  </span>
                  <span className="visually-hidden">
                    {formatCalendarDayLong(day.day)}:{" "}
                    {day.counted === 0
                      ? formatHabitRate(null)
                      : `${day.done} von ${day.counted} zählenden Einheiten, ${formatHabitRate(day.rate)}`}
                  </span>
                </td>
              ))}
              <td className="habit-month-summary-total">
                {view.summary.counted === 0
                  ? formatHabitRate(null)
                  : `${view.summary.done}/${view.summary.counted}`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <ul className="habit-month-legend">
        {legendStates.map((state) => (
          <li key={state}>
            <span aria-hidden="true">
              <TrackerCell
                dayLabel="Beispieltag"
                state={trackerStates[state]}
              />
            </span>
            <span>{habitMonthStateLabels[state]}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

const legendStates: HabitMonthCellState[] = [
  "done",
  "open",
  "skipped",
  "not-due",
  "future",
  "outside",
];
