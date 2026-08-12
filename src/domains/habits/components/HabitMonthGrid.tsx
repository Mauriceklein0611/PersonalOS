import { useEffect, useState, type MouseEvent } from "react";

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
  type HabitMonthDay,
  type HabitMonthView,
  type HabitMonthWeek,
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
  selectedDay: CalendarDay;
  streaks?: ReadonlyMap<string, string>;
  today: CalendarDay;
  view: HabitMonthView;
};

type MonthTableProps = HabitMonthGridProps & {
  days: HabitMonthDay[];
  mode: "month" | "week";
  showSummary: boolean;
  weeks: Array<{ tone: number; week: HabitMonthWeek }>;
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

export function HabitMonthGrid(props: HabitMonthGridProps) {
  const showFullMonth = useWideMonthTable();
  const selectedWeek =
    props.view.weeks.find((week) => week.days.includes(props.selectedDay)) ??
    props.view.weeks[0];
  const selectedWeekDays = selectedWeek
    ? props.view.days.filter((day) => selectedWeek.days.includes(day.day))
    : [];
  const selectedWeekTone = Math.max(
    0,
    props.view.weeks.findIndex((week) => week.start === selectedWeek?.start),
  );

  return (
    <>
      <div
        aria-label="Routinen-Monatsübersicht"
        className="habit-month-grid-shell"
        role="region"
      >
        {showFullMonth ? (
          <MonthTable
            {...props}
            days={props.view.days}
            mode="month"
            showSummary
            weeks={props.view.weeks.map((week, tone) => ({ tone, week }))}
          />
        ) : (
          <MonthTable
            {...props}
            days={selectedWeekDays}
            mode="week"
            showSummary={false}
            weeks={
              selectedWeek
                ? [{ tone: selectedWeekTone, week: selectedWeek }]
                : []
            }
          />
        )}
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

function MonthTable({
  busyHabitId,
  days,
  goalTitles = new Map(),
  mode,
  onArchive,
  onEdit,
  onRestore,
  onSkipToday,
  onToggle,
  selectedDay,
  showSummary,
  streaks = new Map(),
  today,
  view,
  weeks,
}: MonthTableProps) {
  const visibleDays = new Set(days.map((day) => day.day));

  return (
    <table
      className={`ui-tracker-grid habit-month-table habit-month-table-${mode}`}
    >
      <caption className="visually-hidden">
        Routinen stehen in Zeilen, Kalendertage in Spalten. Die markierte
        Datumsspalte enthält die bedienbaren Check-ins. Erledigt, offen,
        übersprungen, nicht fällig, später fällig und außerhalb des Zeitraums
        werden als Zeichen und Text genannt.
      </caption>
      <colgroup>
        <col className="habit-month-name-column" />
        {days.map((day) => (
          <col
            className={
              day.day === selectedDay
                ? "habit-month-selected-column"
                : "habit-month-day-column"
            }
            key={day.day}
          />
        ))}
        {showSummary ? <col className="habit-month-summary-column" /> : null}
      </colgroup>
      <thead>
        <tr>
          <td className="habit-month-corner" />
          {weeks.map(({ tone, week }) => {
            const visibleWeekLength = week.days.filter((day) =>
              visibleDays.has(day),
            ).length;

            return (
              <th
                className={`habit-month-week-tone-${(tone % 6) + 1}`}
                colSpan={visibleWeekLength}
                data-week-start="true"
                key={week.start}
                scope="colgroup"
              >
                <span aria-hidden="true">
                  {visibleWeekLength < 4 ? "" : "Woche ab "}
                  {formatCalendarDayShort(week.start)}
                </span>
                <span className="visually-hidden">
                  Woche ab {formatCalendarDayLong(week.start)}
                </span>
              </th>
            );
          })}
          {showSummary ? <td className="habit-month-summary-corner" /> : null}
        </tr>
        <tr>
          <th scope="col">Routine</th>
          {days.map((day) => (
            <th
              aria-current={day.day === selectedDay ? "date" : undefined}
              data-selected={day.day === selectedDay}
              data-today={day.isToday}
              data-week-start={day.isWeekStart}
              key={day.day}
              scope="col"
            >
              <span aria-hidden="true">{formatCalendarWeekday(day.day)}</span>
              <span aria-hidden="true">{formatCalendarDayNumber(day.day)}</span>
              <span className="visually-hidden">
                {formatCalendarDayLong(day.day)}
                {day.isToday ? ", heute" : ""}
                {day.day === selectedDay ? ", ausgewählt" : ""}
              </span>
            </th>
          ))}
          {showSummary ? (
            <th className="habit-month-summary-heading" scope="col">
              Fortschritt
            </th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {view.rows.map((row) => {
          const isArchived = row.habit.archivedAt !== undefined;
          const todayCell = row.cells.find((cell) => cell.day === today);
          const goalTitle = row.habit.goalId
            ? goalTitles.get(row.habit.goalId)
            : undefined;
          const visibleCells = row.cells.filter((cell) =>
            visibleDays.has(cell.day),
          );
          const rate =
            row.fulfillment && row.fulfillment.counted > 0
              ? formatHabitRate(row.fulfillment.rate)
              : formatHabitRate(null);

          return (
            <tr key={row.habit.id}>
              <th scope="row">
                <div className="habit-month-row-heading">
                  <span className="habit-month-row-copy">
                    <span className="habit-month-row-name">
                      {row.habit.name}
                    </span>
                    {!showSummary ? (
                      <>
                        <span className="habit-month-row-rate">{rate}</span>
                        {goalTitle ? (
                          <span className="habit-month-row-goal">
                            Ziel: {goalTitle}
                          </span>
                        ) : null}
                      </>
                    ) : null}
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
              {visibleCells.map((cell) => {
                const isSelected = cell.day === selectedDay;
                return (
                  <td
                    data-selected={isSelected}
                    data-week-start={
                      days.find((day) => day.day === cell.day)?.isWeekStart
                    }
                    key={cell.day}
                  >
                    <TrackerCell
                      actionLabel={
                        isSelected && cell.interactive
                          ? habitMonthActionLabels[cell.state]
                          : undefined
                      }
                      dayLabel={`${row.habit.name} am ${formatCalendarDayLong(cell.day)}`}
                      disabled={
                        isSelected && cell.interactive
                          ? busyHabitId === row.habit.id
                          : undefined
                      }
                      onClick={
                        isSelected && cell.interactive
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
                );
              })}
              {showSummary ? (
                <td className="habit-month-row-summary">
                  <strong>{rate}</strong>
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
              ) : null}
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">Erledigt je Tag</th>
          {days.map((day) => (
            <td
              data-selected={day.day === selectedDay}
              data-week-start={day.isWeekStart}
              key={day.day}
            >
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
          {showSummary ? (
            <td className="habit-month-summary-total">
              {view.summary.counted === 0
                ? formatHabitRate(null)
                : `${view.summary.done}/${view.summary.counted}`}
            </td>
          ) : null}
        </tr>
      </tfoot>
    </table>
  );
}

function useWideMonthTable(): boolean {
  const query = "(min-width: 64rem)";
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const update = () => setMatches(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return matches;
}

const legendStates: HabitMonthCellState[] = [
  "done",
  "open",
  "skipped",
  "not-due",
  "future",
  "outside",
];
