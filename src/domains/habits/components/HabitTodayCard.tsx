import { Button } from "../../../components/ui";
import type { CalendarDay } from "../../../lib/dates/date-values";
import type { Habit, HabitEntry, HabitEntryStatus } from "../model";
import {
  getHabitDayState,
  getHabitScheduleLabel,
  habitDayStateLabels,
} from "../view-model";

type HabitTodayCardProps = {
  busy: boolean;
  entries: readonly HabitEntry[];
  habit: Habit;
  onArchive: (habit: Habit) => void;
  onCheckIn: (habit: Habit, status: HabitEntryStatus) => void;
  onEdit: (habit: Habit) => void;
  onReopen: (habit: Habit) => void;
  today: CalendarDay;
};

export function HabitTodayCard({
  busy,
  entries,
  habit,
  onArchive,
  onCheckIn,
  onEdit,
  onReopen,
  today,
}: HabitTodayCardProps) {
  const state = getHabitDayState(habit, entries, today);
  const headingId = `habit-${habit.id}`;

  return (
    <article className="habit-card" aria-labelledby={headingId}>
      <div className="habit-card-copy">
        <p className={`habit-state habit-state-${state}`}>
          {habitDayStateLabels[state]}
        </p>
        <h3 id={headingId}>{habit.name}</h3>
        <p className="habit-schedule">
          {getHabitScheduleLabel(habit.schedule)}
        </p>
        {habit.description ? (
          <p className="habit-description">{habit.description}</p>
        ) : null}
      </div>
      <div className="habit-primary-actions">
        {state === "open" ? (
          <>
            <Button
              aria-label={`„${habit.name}“ heute erledigen`}
              disabled={busy}
              onClick={() => onCheckIn(habit, "done")}
            >
              Erledigt
            </Button>
            <Button
              aria-label={`„${habit.name}“ heute überspringen`}
              disabled={busy}
              onClick={() => onCheckIn(habit, "skipped")}
              variant="ghost"
            >
              Heute überspringen
            </Button>
          </>
        ) : state === "done" ? (
          <Button
            aria-label={`„${habit.name}“ heute wieder öffnen`}
            disabled={busy}
            onClick={() => onReopen(habit)}
            variant="secondary"
          >
            Wieder öffnen
          </Button>
        ) : state === "skipped" ? (
          <>
            <Button
              aria-label={`„${habit.name}“ heute doch erledigen`}
              disabled={busy}
              onClick={() => onCheckIn(habit, "done")}
            >
              Doch erledigt
            </Button>
            <Button
              aria-label={`„${habit.name}“ heute wieder öffnen`}
              disabled={busy}
              onClick={() => onReopen(habit)}
              variant="ghost"
            >
              Wieder öffnen
            </Button>
          </>
        ) : null}
      </div>
      <div className="habit-manage-actions">
        <Button
          aria-label={`„${habit.name}“ bearbeiten`}
          disabled={busy}
          onClick={() => onEdit(habit)}
          variant="secondary"
        >
          Bearbeiten
        </Button>
        <Button
          aria-label={`„${habit.name}“ archivieren`}
          disabled={busy}
          onClick={() => onArchive(habit)}
          variant="ghost"
        >
          Archivieren
        </Button>
      </div>
    </article>
  );
}
