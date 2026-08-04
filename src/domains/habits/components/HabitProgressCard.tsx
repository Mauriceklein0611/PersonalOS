import { ProgressBar } from "../../../components/ui";
import type { CalendarDay } from "../../../lib/dates/date-values";
import { calculateHabitFulfillment, calculateHabitStreak } from "../metrics";
import type { Habit, HabitEntry } from "../model";
import {
  formatCalendarDay,
  formatHabitRate,
  formatHabitStreak,
  getHabitProgressRange,
  getHabitScheduleLabel,
  getHabitTargetUnitLabel,
  type HabitProgressPeriod,
} from "../view-model";

type HabitProgressCardProps = {
  entries: readonly HabitEntry[];
  habit: Habit;
  period: HabitProgressPeriod;
  today: CalendarDay;
};

export function HabitProgressCard({
  entries,
  habit,
  period,
  today,
}: HabitProgressCardProps) {
  const headingId = `habit-progress-${habit.id}`;
  const range = getHabitProgressRange(habit, period, today);

  if (!range) {
    return (
      <article aria-labelledby={headingId} className="habit-progress-card">
        <h3 id={headingId}>{habit.name}</h3>
        <p className="habit-progress-hint">
          Die Auswertung startet am {formatCalendarDay(habit.startDate)}.
        </p>
      </article>
    );
  }

  const fulfillment = calculateHabitFulfillment(
    habit,
    entries,
    range.from,
    range.to,
  );
  const streak = calculateHabitStreak(habit, entries, today);
  const unitLabel = getHabitTargetUnitLabel(habit.schedule);

  return (
    <article aria-labelledby={headingId} className="habit-progress-card">
      <h3 id={headingId}>{habit.name}</h3>
      <p className="habit-progress-schedule">
        {getHabitScheduleLabel(habit.schedule)}
      </p>

      <dl className="habit-progress-figures">
        <div>
          <dt>Aktuelle Serie</dt>
          <dd>{formatHabitStreak(streak.unit, streak.current)}</dd>
        </div>
        <div>
          <dt>Beste Serie</dt>
          <dd>{formatHabitStreak(streak.unit, streak.best)}</dd>
        </div>
      </dl>

      <ProgressBar
        label="Erfüllungsquote"
        value={fulfillment.rate}
        valueText={formatHabitRate(fulfillment.rate)}
      />

      <p className="habit-progress-period">
        Zeitraum: {formatCalendarDay(range.from)} bis{" "}
        {formatCalendarDay(range.to)}
      </p>
      <p className="habit-progress-basis">
        Berechnungsbasis: {fulfillment.done} von {fulfillment.target}{" "}
        {unitLabel} erledigt, {fulfillment.skipped} übersprungen. Übersprungene
        Tage werden separat gezählt und nicht als erledigt gewertet.
      </p>
      {fulfillment.target === 0 ? (
        <p className="habit-progress-hint">
          In diesem Zeitraum war noch nichts geplant.
        </p>
      ) : null}
    </article>
  );
}
