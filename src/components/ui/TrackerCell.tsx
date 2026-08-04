import { classNames } from "../../lib/class-names";
import { noDataText, type DataSeriesTone } from "./data-series";

export type TrackerCellState = "done" | "partial" | "skipped" | "open" | "none";

export type TrackerCellProps = {
  /** Beschreibt, worauf sich die Zelle bezieht, etwa „Mo, 3. August“. */
  dayLabel: string;
  state: TrackerCellState;
  /** Beschreibt die Wirkung des Klicks, etwa „Als erledigt eintragen“. */
  actionLabel?: string;
  className?: string;
  disabled?: boolean;
  /** Macht die Zelle zu einer Schaltfläche. Ohne Handler bleibt sie Text. */
  onClick?: () => void;
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
  actionLabel,
  className,
  dayLabel,
  disabled,
  onClick,
  state,
  stateLabel,
  tone,
}: TrackerCellProps) {
  const label = stateLabel ?? stateLabels[state];
  const cellClassName = classNames("ui-tracker-cell", className);
  const cellTone = state === "done" || state === "partial" ? tone : undefined;
  const sign = (
    <span aria-hidden="true" className="ui-tracker-cell-sign">
      {stateSigns[state]}
    </span>
  );

  if (onClick) {
    return (
      <button
        aria-label={
          actionLabel
            ? `${dayLabel}: ${label}. ${actionLabel}`
            : `${dayLabel}: ${label}`
        }
        className={cellClassName}
        data-state={state}
        data-tone={cellTone}
        disabled={disabled}
        onClick={onClick}
        type="button"
      >
        {sign}
      </button>
    );
  }

  return (
    <span className={cellClassName} data-state={state} data-tone={cellTone}>
      {sign}
      <span className="visually-hidden">
        {dayLabel}: {label}
      </span>
    </span>
  );
}
