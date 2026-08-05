import { useId } from "react";

import { classNames } from "../../lib/class-names";
import {
  clampRatio,
  formatRatio,
  noDataText,
  type DataSeriesTone,
} from "./data-series";

export type ProgressRingProps = {
  label: string;
  /** Anteil zwischen 0 und 1. `null` bedeutet: keine Datenbasis. */
  value: number | null;
  caption?: string;
  className?: string;
  error?: string;
  /**
   * Hebt den primären Fortschritt einer Ansicht hervor. Je Ansicht ist genau
   * ein Glow erlaubt, damit er eine Aussage behält.
   */
  glow?: boolean;
  size?: "sm" | "md";
  /** Ohne Angabe bleibt der Ring ein dekorativer Verlauf ohne Kategorie. */
  tone?: DataSeriesTone;
  /** Ersetzt den Prozenttext, zum Beispiel „3 von 5“. */
  valueText?: string;
};

const radius = 44;
const circumference = 2 * Math.PI * radius;

export function ProgressRing({
  caption,
  className,
  error,
  glow = false,
  label,
  size = "md",
  tone,
  value,
  valueText,
}: ProgressRingProps) {
  const gradientId = useId();
  const hasValue = value !== null && error === undefined;
  const ratio = hasValue ? clampRatio(value) : 0;

  return (
    <div
      className={classNames("ui-progress-ring", className)}
      data-glow={glow && hasValue}
      data-size={size}
    >
      <div className="ui-progress-ring-visual">
        <svg aria-hidden="true" focusable="false" viewBox="0 0 100 100">
          {tone === undefined ? (
            <defs>
              <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
                <stop className="ui-progress-ring-gradient-start" offset="0%" />
                <stop className="ui-progress-ring-gradient-end" offset="100%" />
              </linearGradient>
            </defs>
          ) : null}
          <circle
            className="ui-progress-ring-track"
            cx="50"
            cy="50"
            fill="none"
            r={radius}
          />
          {hasValue && ratio > 0 ? (
            <circle
              className="ui-progress-ring-value"
              cx="50"
              cy="50"
              data-tone={tone}
              fill="none"
              r={radius}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - ratio)}
              {...(tone === undefined
                ? { stroke: `url(#${gradientId})` }
                : null)}
            />
          ) : null}
        </svg>
        <p className="ui-progress-ring-text" data-empty={!hasValue}>
          {hasValue ? (valueText ?? formatRatio(value)) : noDataText}
        </p>
      </div>
      <p className="ui-progress-ring-label">{label}</p>
      {error ? <p className="ui-dataviz-error">{error}</p> : null}
      {error === undefined && caption ? (
        <p className="ui-progress-ring-caption">{caption}</p>
      ) : null}
    </div>
  );
}
