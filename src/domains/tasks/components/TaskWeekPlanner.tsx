import { ProgressBar, ViewPurpose } from "../../../components/ui";
import type { CalendarDay } from "../../../lib/dates/date-values";
import type { Task } from "../model";
import type { TaskQueryContext } from "../queries";
import {
  formatCalendarDay,
  formatCalendarDayNumber,
  formatCalendarWeekdayLong,
  formatCalendarWeekdayShort,
} from "../view-model";
import type { TaskWeekPlan } from "../week-plan";
import { TaskRow } from "./TaskRow";

type TaskWeekPlannerProps = {
  busyTaskId?: string;
  context: TaskQueryContext;
  goalTitles: ReadonlyMap<string, string>;
  onArchive: (task: Task) => void;
  onCancel: (task: Task) => void;
  onComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onReopen: (task: Task) => void;
  onSelectDay: (day: CalendarDay) => void;
  plan: TaskWeekPlan;
  selectedDay: CalendarDay;
};

/**
 * Die Woche als sieben Tagesbereiche.
 *
 * Auf Mobil steht der Wochentagsstreifen über genau einem Tagesbereich:
 * Sieben schmale Spalten nebeneinander wären auf 390 px weder lesbar noch
 * bedienbar. Ab 40 rem stehen mehrere Tage nebeneinander, ab 75 rem alle
 * sieben; der Streifen entfällt dort, weil jeder Tag ohnehin sichtbar ist.
 *
 * Die Ansicht ersetzt keine Liste und plant nichts selbst um. Ein anderes
 * Plandatum wird dort gesetzt, wo es gespeichert wird: in der Bearbeitung.
 */
export function TaskWeekPlanner({
  busyTaskId,
  context,
  goalTitles,
  onArchive,
  onCancel,
  onComplete,
  onEdit,
  onReopen,
  onSelectDay,
  plan,
  selectedDay,
}: TaskWeekPlannerProps) {
  return (
    <div className="task-week-planner">
      <ViewPurpose
        period={`${formatCalendarDay(plan.from)} bis ${formatCalendarDay(plan.to)}`}
        purpose="Der Wochenplan ordnet ausschließlich Aufgaben mit Plandatum den sieben Tagen zu. Aufgaben ohne Plandatum bleiben in der Inbox."
        question="Was habe ich an welchem Tag eingeplant?"
      />
      <p className="task-week-summary">
        Woche vom {formatCalendarDay(plan.from)} bis{" "}
        {formatCalendarDay(plan.to)}:{" "}
        {plan.planned === 0
          ? "keine Aufgabe mit Plandatum."
          : `${plan.completed} von ${plan.planned} geplanten Aufgaben erledigt.`}
      </p>

      {/*
        Der Streifen ist die einzige Navigation der Ansicht: ein Tap je Tag,
        jeder Tag ein eigenes 44-px-Ziel.
      */}
      <ul aria-label="Wochentag wählen" className="task-week-strip">
        {plan.days.map((day) => (
          <li key={day.day}>
            <button
              aria-current={day.day === selectedDay ? "date" : undefined}
              aria-label={`${formatCalendarWeekdayLong(day.day)}, ${formatCalendarDay(day.day)}: ${
                day.planned === 0
                  ? "nichts geplant"
                  : `${day.completed} von ${day.planned} erledigt`
              }`}
              className="task-week-strip-day"
              data-today={day.isToday}
              onClick={() => onSelectDay(day.day)}
              type="button"
            >
              <span aria-hidden="true">
                {formatCalendarWeekdayShort(day.day)}
              </span>
              <span aria-hidden="true">{formatCalendarDayNumber(day.day)}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="task-week-days">
        {plan.days.map((day) => {
          const headingId = `task-week-${day.day}`;
          return (
            <section
              aria-labelledby={headingId}
              className="ui-dense-panel task-week-day"
              data-selected={day.day === selectedDay}
              data-today={day.isToday}
              key={day.day}
            >
              {/* Der Tag steht über seinen Aufgaben, deshalb eine Ebene höher. */}
              <h2 className="task-week-day-title" id={headingId}>
                {formatCalendarWeekdayLong(day.day)},{" "}
                {formatCalendarDay(day.day)}
                {day.isToday ? " (heute)" : ""}
              </h2>
              <ProgressBar
                className="task-week-day-progress"
                label="Erledigt"
                value={day.rate}
                valueText={`${day.completed} von ${day.planned}`}
              />
              {day.tasks.length === 0 ? (
                <p className="task-week-day-empty">
                  Für diesen Tag ist nichts geplant.
                </p>
              ) : (
                <ul
                  aria-label={`Aufgaben am ${formatCalendarDay(day.day)}`}
                  className="ui-dense-list"
                >
                  {day.tasks.map((task) => (
                    <TaskRow
                      busy={busyTaskId === task.id}
                      context={context}
                      headingLevel={3}
                      goalTitle={
                        task.goalId === undefined
                          ? undefined
                          : goalTitles.get(task.goalId)
                      }
                      key={task.id}
                      onArchive={onArchive}
                      onCancel={onCancel}
                      onComplete={onComplete}
                      onEdit={onEdit}
                      onReopen={onReopen}
                      task={task}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
