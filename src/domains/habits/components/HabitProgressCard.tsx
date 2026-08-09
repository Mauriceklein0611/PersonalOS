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
  getHabitUnitLabel,
  type HabitProgressPeriod,
} from "../view-model";

type HabitProgressCardProps = {
  entries: readonly HabitEntry[];
  /**
   * Der Titel des verknüpften Ziels, aufgelöst über den Link-Service der
   * Zieldomain. Die Gewohnheitsdomain liest die Ziele nicht selbst
   * (`AGENTS.md` §3).
   */
  goalTitle?: string;
  habit: Habit;
  period: HabitProgressPeriod;
  today: CalendarDay;
};

export function HabitProgressCard({
  entries,
  goalTitle,
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
  const targetUnitLabel = getHabitTargetUnitLabel(habit.schedule);
  const unitLabel = getHabitUnitLabel(habit.schedule);

  return (
    <article aria-labelledby={headingId} className="habit-progress-card">
      <h3 id={headingId}>{habit.name}</h3>
      <p className="habit-progress-schedule">
        {getHabitScheduleLabel(habit.schedule)}
        {/* Ohne Verknüpfung oder ohne auflösbaren Titel fehlt der Zusatz. */}
        {goalTitle ? ` · Ziel: ${goalTitle}` : null}
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
        Berechnungsbasis: {fulfillment.done} von {fulfillment.counted} zählenden{" "}
        {unitLabel} erledigt, bei {fulfillment.target} {targetUnitLabel} und{" "}
        {fulfillment.skipped} übersprungen. Übersprungen heißt bewusst
        ausgelassen: Diese Einheiten zählen weder als erledigt noch im Nenner.
        Ein geplanter Tag ohne Eintrag gilt als nicht erfasst und bleibt im
        Nenner.
      </p>
      {fulfillment.target === 0 ? (
        <p className="habit-progress-hint">
          In diesem Zeitraum war noch nichts geplant.
        </p>
      ) : fulfillment.counted === 0 ? (
        <p className="habit-progress-hint">
          Alle geplanten Einheiten dieses Zeitraums sind übersprungen. Daraus
          lässt sich keine Quote ableiten.
        </p>
      ) : null}
    </article>
  );
}
