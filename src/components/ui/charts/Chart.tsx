import { lazy, Suspense } from "react";

import { classNames } from "../../../lib/class-names";
import { dataSeriesMarkers, noDataText } from "../data-series";
import { Skeleton } from "../Skeleton";
import { maximumChartSeries, type ChartSeries } from "./chart-series";

/**
 * Die Bibliothek liegt in einem eigenen Chunk und wird erst geladen, wenn
 * tatsächlich ein Diagramm erscheint. Rahmen, Tabelle und Leerzustand
 * funktionieren ohne sie.
 */
const ChartCanvas = lazy(() => import("./ChartCanvas"));

export type { ChartSeries };

export type ChartProps = {
  /** Beschriftung der Kategorieachse, eine je Datenpunkt. */
  categories: string[];
  /** Zeitraum der Darstellung, zum Beispiel „1. bis 7. August“. */
  period: string;
  series: ChartSeries[];
  /** Datenbasis: worauf die Darstellung beruht. */
  source: string;
  title: string;
  className?: string;
  emptyMessage?: string;
  error?: string;
  formatValue?: (value: number) => string;
  /** Balken liegend, für Ranglisten mit langen Beschriftungen. */
  horizontal?: boolean;
  type?: "line" | "bar";
};

export function Chart({
  categories,
  className,
  emptyMessage,
  error,
  formatValue = (value) => String(value),
  horizontal = false,
  period,
  series,
  source,
  title,
  type = "line",
}: ChartProps) {
  const visibleSeries = series.slice(0, maximumChartSeries);
  const hasData = visibleSeries.some((entry) =>
    entry.values.some((value) => value !== null),
  );
  const showChart = error === undefined && hasData && categories.length > 0;

  return (
    <figure className={classNames("ui-chart", className)}>
      <figcaption className="ui-chart-head">
        <p className="ui-chart-title">{title}</p>
        <p className="ui-chart-period">{period}</p>
      </figcaption>

      {error ? <p className="ui-dataviz-error">{error}</p> : null}

      {showChart ? (
        <>
          <Suspense
            fallback={
              <div aria-hidden="true" className="ui-chart-plot">
                <Skeleton lines={1} />
              </div>
            }
          >
            <ChartCanvas
              categories={categories}
              formatValue={formatValue}
              horizontal={horizontal}
              series={visibleSeries}
              type={type}
            />
          </Suspense>
          <ChartTable
            categories={categories}
            formatValue={formatValue}
            series={visibleSeries}
            title={title}
          />
          <ul className="ui-chart-legend">
            {visibleSeries.map((entry) => (
              <li className="ui-chart-legend-item" key={entry.id}>
                <span
                  aria-hidden="true"
                  className="ui-chart-legend-marker"
                  data-tone={entry.tone}
                >
                  {dataSeriesMarkers[entry.tone]}
                </span>
                {entry.label}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {error === undefined && !showChart ? (
        <p className="ui-chart-empty">{emptyMessage ?? noDataText}</p>
      ) : null}

      <p className="ui-chart-source">{source}</p>
    </figure>
  );
}

type TableProps = Required<Pick<ChartProps, "categories" | "formatValue">> & {
  series: ChartSeries[];
  title: string;
};

/**
 * Dieselben Werte als Tabelle. Das Diagramm ist `aria-hidden`; die Aussage
 * hängt damit nie an Farbe oder Form.
 */
function ChartTable({ categories, formatValue, series, title }: TableProps) {
  return (
    <table className="visually-hidden">
      <caption>{`${title}: Werte als Tabelle`}</caption>
      <thead>
        <tr>
          <th scope="col">Zeitpunkt</th>
          {series.map((entry) => (
            <th key={entry.id} scope="col">
              {entry.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {categories.map((category, index) => (
          <tr key={category}>
            <th scope="row">{category}</th>
            {series.map((entry) => {
              const value = entry.values[index];
              return (
                <td key={entry.id}>
                  {value === null || value === undefined
                    ? noDataText
                    : formatValue(value)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
