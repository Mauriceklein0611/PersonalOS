import { useId } from "react";

import { classNames } from "../../lib/class-names";
import {
  clampRatio,
  formatRatio,
  noDataText,
  type DataSeriesTone,
} from "./data-series";

export type ProgressBarProps = {
  label: string;
  /** Anteil zwischen 0 und 1. `null` bedeutet: keine Datenbasis. */
  value: number | null;
  caption?: string;
  className?: string;
  error?: string;
  tone?: DataSeriesTone;
  /** Ersetzt den Prozenttext, zum Beispiel „12 von 20“. */
  valueText?: string;
};

export function ProgressBar({
  caption,
  className,
  error,
  label,
  tone = 1,
  value,
  valueText,
}: ProgressBarProps) {
  const progressId = useId();
  const hasValue = value !== null && error === undefined;
  const ratio = hasValue ? clampRatio(value) : 0;

  return (
    <div className={classNames("ui-progress-bar", className)}>
      <div className="ui-progress-bar-head">
        {hasValue ? (
          <label className="ui-progress-bar-label" htmlFor={progressId}>
            {label}
          </label>
        ) : (
          <span className="ui-progress-bar-label">{label}</span>
        )}
        <span className="ui-progress-bar-value" data-empty={!hasValue}>
          {hasValue ? (valueText ?? formatRatio(value)) : noDataText}
        </span>
      </div>
      {hasValue ? (
        <progress
          className="ui-progress-bar-track"
          data-tone={tone}
          id={progressId}
          max={100}
          value={Math.round(ratio * 100)}
        />
      ) : (
        <span aria-hidden="true" className="ui-progress-bar-track-empty" />
      )}
      {error ? <p className="ui-dataviz-error">{error}</p> : null}
      {error === undefined && caption ? (
        <p className="ui-progress-bar-caption">{caption}</p>
      ) : null}
    </div>
  );
}
