import { classNames } from "../../lib/class-names";
import { noDataText, type DataSeriesTone } from "./data-series";

export type TrackerCellState = "done" | "partial" | "skipped" | "open" | "none";

export type TrackerCellProps = {
  /** Beschreibt, worauf sich die Zelle bezieht, etwa „Mo, 3. August“. */
  dayLabel: string;
  state: TrackerCellState;
  className?: string;
  /** Ersetzt den Standardtext des Zustands. */
  stateLabel?: string;
  /** Optionale Wochenfarbe. Sie ergänzt Zeichen und Text, ersetzt sie nie. */
  tone?: DataSeriesTone;
};

const stateSigns: Record<TrackerCellState, string> = {
  done: "✓",
  partial: "◐",
  skipped: "–",
  open: "○",
  none: "·",
};

const stateLabels: Record<TrackerCellState, string> = {
  done: "Erledigt",
  partial: "Teilweise",
  skipped: "Übersprungen",
  open: "Offen",
  none: noDataText,
};

export function TrackerCell({
  className,
  dayLabel,
  state,
  stateLabel,
  tone,
}: TrackerCellProps) {
  return (
    <span
      className={classNames("ui-tracker-cell", className)}
      data-state={state}
      data-tone={state === "done" || state === "partial" ? tone : undefined}
    >
      <span aria-hidden="true" className="ui-tracker-cell-sign">
        {stateSigns[state]}
      </span>
      <span className="visually-hidden">
        {dayLabel}: {stateLabel ?? stateLabels[state]}
      </span>
    </span>
  );
}
