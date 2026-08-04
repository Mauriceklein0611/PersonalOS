import type { ReactNode } from "react";

import { classNames } from "../../lib/class-names";
import {
  dataSeriesMarkers,
  noDataText,
  type DataSeriesTone,
} from "./data-series";

export type ChartLegendEntry = {
  id: string;
  label: string;
  tone: DataSeriesTone;
};

export type ChartFrameProps = {
  /** Datenbasis: worauf die Darstellung beruht. */
  source: string;
  /** Zeitraum der Darstellung, zum Beispiel „1. bis 7. August“. */
  period: string;
  title: string;
  children?: ReactNode;
  className?: string;
  emptyMessage?: string;
  error?: string;
  legend?: ChartLegendEntry[];
};

export function ChartFrame({
  children,
  className,
  emptyMessage,
  error,
  legend,
  period,
  source,
  title,
}: ChartFrameProps) {
  const showChart = error === undefined && children !== undefined;

  return (
    <figure className={classNames("ui-chart-frame", className)}>
      <figcaption className="ui-chart-frame-head">
        <p className="ui-chart-frame-title">{title}</p>
        <p className="ui-chart-frame-period">{period}</p>
      </figcaption>

      {error ? <p className="ui-dataviz-error">{error}</p> : null}

      {showChart ? <div className="ui-chart-frame-plot">{children}</div> : null}

      {error === undefined && !showChart ? (
        <p className="ui-chart-frame-empty">{emptyMessage ?? noDataText}</p>
      ) : null}

      {showChart && legend && legend.length > 0 ? (
        <ul className="ui-chart-frame-legend">
          {legend.map((entry) => (
            <li className="ui-chart-frame-legend-item" key={entry.id}>
              <span
                aria-hidden="true"
                className="ui-chart-frame-legend-marker"
                data-tone={entry.tone}
              >
                {dataSeriesMarkers[entry.tone]}
              </span>
              {entry.label}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="ui-chart-frame-source">{source}</p>
    </figure>
  );
}
