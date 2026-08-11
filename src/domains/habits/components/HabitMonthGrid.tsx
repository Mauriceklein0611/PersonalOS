import { TrackerCell, type TrackerCellState } from "../../../components/ui";
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
  onToggle: (habit: Habit, day: CalendarDay, isDone: boolean) => void;
  view: HabitMonthView;
};

/**
 * Zukünftige und nicht fällige Tage teilen sich die leere Zelle: In beiden
 * Fällen liegt nichts vor. Der Text der Zelle unterscheidet sie trotzdem.
 */
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
  onToggle,
  view,
}: HabitMonthGridProps) {
  return (
    <>
      <div
        aria-label="Monatsstatus, horizontal scrollbar"
        className="ui-tracker-scroller habit-month-scroll"
        role="region"
        tabIndex={0}
      >
        <table className="ui-tracker-grid habit-month-table">
          {/*
            Die Beschriftung ist so breit wie die Tabelle und damit breiter als
            der Viewport. Sichtbar stünde sie angeschnitten hinter dem Rand;
            ihre Aussage trägt die Legende unter dem Raster.
          */}
          <caption className="visually-hidden">
            Erledigt, offen, übersprungen, nicht fällig, später fällig und
            außerhalb des Zeitraums stehen jeweils als Zeichen und als Text in
            der Zelle.
          </caption>
          <thead>
            <tr>
              <td className="habit-month-corner" />
              {view.weeks.map((week) => (
                <th
                  colSpan={week.days.length}
                  data-week-start="true"
                  key={week.start}
                  scope="colgroup"
                >
                  <span aria-hidden="true">
                    ab {formatCalendarDayShort(week.start)}
                  </span>
                  <span className="visually-hidden">
                    Woche ab {formatCalendarDayLong(week.start)}
                  </span>
                </th>
              ))}
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
            </tr>
          </thead>
          <tbody>
            {view.rows.map((row) => (
              <tr key={row.habit.id}>
                <th scope="row">
                  <span className="habit-month-row-name">{row.habit.name}</span>
                  {/*
                    Ohne zählende Einheit gibt es keinen Nenner. „0 von 0“
                    stünde dort als Zahl, die nichts misst.
                  */}
                  <span className="habit-month-row-rate">
                    {row.fulfillment && row.fulfillment.counted > 0
                      ? `${row.fulfillment.done} von ${row.fulfillment.counted} · ${formatHabitRate(row.fulfillment.rate)}`
                      : formatHabitRate(null)}
                  </span>
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
              </tr>
            ))}
          </tbody>
          {/*
          Die Tageszusammenfassung steht als Fußzeile unter ihren Spalten.
          Zähler und Nenner stehen sichtbar, der ganze Satz für assistive
          Technik daneben.
        */}
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
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Die Legende steht hinter dem Raster: Sie erklärt, was dort steht. */}
      <ul className="habit-month-legend">
        {legendStates.map((state) => (
          <li key={state}>
            {/* Das Zeichen steht neben seinem Text; einmal genannt genügt. */}
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
