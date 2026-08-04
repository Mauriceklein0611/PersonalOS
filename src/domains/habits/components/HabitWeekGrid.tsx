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
      className="habit-week-scroll"
      role="region"
      tabIndex={0}
    >
      <table className="habit-week-table">
        <caption className="habit-week-caption">
          Erledigt, offen, übersprungen und nicht fällig stehen jeweils als
          Zeichen und als Text in der Zelle.
        </caption>
        <thead>
          <tr>
            <th scope="col">Gewohnheit</th>
            {days.map((day) => (
              <th key={day} scope="col">
                <span>{formatCalendarWeekday(day)}</span>
                <span>{formatCalendarDayShort(day)}</span>
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
                  const label = habitDayStateLabels[state];
                  const eligible = isHabitEligibleOn(habit, day);
                  const outdated =
                    !eligible && (state === "done" || state === "skipped");
                  const interactive =
                    eligible && day <= today && habit.archivedAt === undefined;
                  return (
                    <td key={day}>
                      {interactive ? (
                        <button
                          aria-label={`${habit.name} am ${formatCalendarDayLong(day)}: ${label}. ${habitDayActionLabels[state]}`}
                          className={`habit-day-cell habit-day-button habit-day-${state}`}
                          disabled={busyHabitId === habit.id}
                          onClick={() => onToggle(habit, day, state)}
                          type="button"
                        >
                          <span aria-hidden="true">{stateSymbol(state)}</span>
                          <span>{label}</span>
                        </button>
                      ) : (
                        <div
                          className={`habit-day-cell habit-day-static habit-day-${state}`}
                        >
                          <span aria-hidden="true">{stateSymbol(state)}</span>
                          <span>{label}</span>
                          {outdated ? (
                            <span className="habit-day-note">
                              Früherer Rhythmus
                            </span>
                          ) : null}
                        </div>
                      )}
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

function stateSymbol(state: HabitDayState): string {
  return { done: "✓", "not-due": "–", open: "○", skipped: "↷" }[state];
}
