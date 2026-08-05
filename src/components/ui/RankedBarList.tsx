import { useId, type CSSProperties } from "react";

import { classNames } from "../../lib/class-names";
import { noDataText, type DataSeriesTone } from "./data-series";

export type RankedBarItem = {
  id: string;
  label: string;
  value: number;
  /** Ersetzt die formatierte Zahl, zum Beispiel „12 von 20“. */
  valueText?: string;
};

export type RankedBarListProps = {
  label: string;
  items: RankedBarItem[];
  caption?: string;
  className?: string;
  emptyMessage?: string;
  error?: string;
  tone?: DataSeriesTone;
};

/** Orientierung statt Rangordnung: mehr Einträge werden nicht gezeigt. */
const maximumItems = 5;
const numberFormat = new Intl.NumberFormat("de-DE");

export function RankedBarList({
  caption,
  className,
  emptyMessage,
  error,
  items,
  label,
  tone = 1,
}: RankedBarListProps) {
  const labelId = useId();
  const visibleItems = items.slice(0, maximumItems);
  const reference = Math.max(...visibleItems.map((item) => item.value), 0);

  return (
    <div className={classNames("ui-ranked-bar-list", className)}>
      <p className="ui-ranked-bar-list-label" id={labelId}>
        {label}
      </p>
      {error ? <p className="ui-dataviz-error">{error}</p> : null}
      {error === undefined && visibleItems.length === 0 ? (
        <p className="ui-ranked-bar-list-empty">{emptyMessage ?? noDataText}</p>
      ) : null}
      {error === undefined && visibleItems.length > 0 ? (
        <ul aria-labelledby={labelId} className="ui-ranked-bar-list-items">
          {visibleItems.map((item) => (
            <li className="ui-ranked-bar-list-item" key={item.id}>
              <span className="ui-ranked-bar-list-name">{item.label}</span>
              <span
                aria-hidden="true"
                className="ui-ranked-bar-list-bar"
                data-tone={tone}
                style={
                  {
                    "--ranked-bar-width": `${toWidth(item.value, reference)}%`,
                  } as CSSProperties
                }
              />
              <span className="ui-ranked-bar-list-value">
                {item.valueText ?? numberFormat.format(item.value)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {error === undefined && caption ? (
        <p className="ui-ranked-bar-list-caption">{caption}</p>
      ) : null}
    </div>
  );
}

function toWidth(value: number, reference: number): number {
  if (reference <= 0 || !Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((value / reference) * 100));
}
