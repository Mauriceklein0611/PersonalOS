import { TrackerCell, type TrackerCellState } from "../../../components/ui";
import type { CalendarDay } from "../../../lib/dates/date-values";
import type { Habit, HabitEntry } from "../model";
import { isHabitEligibleOn } from "../schedule";
import {
  formatCalendarDayLong,
  formatCalendarDayShort,
  formatCalendarWeekday,
  getHabitDayState,
  habitDayActionLabels,
  habitDayStateLabels,
  type HabitDayState,
} from "../view-model";

type HabitWeekGridProps = {
  busyHabitId?: string;
  days: CalendarDay[];
  entriesByHabit: ReadonlyMap<string, readonly HabitEntry[]>;
  habits: Habit[];
  onToggle: (habit: Habit, day: CalendarDay, state: HabitDayState) => void;
  today: CalendarDay;
};

/** Ein Tag ohne Fälligkeit ist keine verpasste Gelegenheit, sondern leer. */
const trackerStates: Record<HabitDayState, TrackerCellState> = {
  done: "done",
  "not-due": "none",
  open: "open",
  skipped: "skipped",
};

export function HabitWeekGrid({
  busyHabitId,
  days,
  entriesByHabit,
  habits,
  onToggle,
  today,
}: HabitWeekGridProps) {
  return (
    <div
      aria-label="Wochenstatus, horizontal scrollbar"
      className="ui-tracker-scroller habit-week-scroll"
      role="region"
      tabIndex={0}
    >
      <table className="ui-tracker-grid habit-week-table">
        <caption className="habit-week-caption">
          Erledigt, offen, übersprungen und nicht fällig stehen jeweils als
          Zeichen und als Text in der Zelle.
        </caption>
        <thead>
          <tr>
            <th scope="col">Routine</th>
            {/* Die heutige Spalte trägt zusätzlich zur Fläche ein Wort. */}
            {days.map((day) => (
              <th data-today={day === today} key={day} scope="col">
                <span>{formatCalendarWeekday(day)}</span>
                <span>{formatCalendarDayShort(day)}</span>
                {day === today ? <span>Heute</span> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {habits.map((habit) => {
            const entries = entriesByHabit.get(habit.id) ?? [];
            return (
              <tr key={habit.id}>
                <th scope="row">{habit.name}</th>
                {days.map((day) => {
                  const state = getHabitDayState(habit, entries, day);
                  const eligible = isHabitEligibleOn(habit, day);
                  const outdated =
                    !eligible && (state === "done" || state === "skipped");
                  const interactive =
                    eligible && day <= today && habit.archivedAt === undefined;
                  const dayLabel = `${habit.name} am ${formatCalendarDayLong(day)}`;

                  return (
                    <td key={day}>
                      <TrackerCell
                        actionLabel={
                          interactive ? habitDayActionLabels[state] : undefined
                        }
                        dayLabel={dayLabel}
                        disabled={
                          interactive ? busyHabitId === habit.id : undefined
                        }
                        onClick={
                          interactive
                            ? () => onToggle(habit, day, state)
                            : undefined
                        }
                        state={trackerStates[state]}
                        stateLabel={
                          outdated
                            ? `${habitDayStateLabels[state]}, früherer Rhythmus`
                            : habitDayStateLabels[state]
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
