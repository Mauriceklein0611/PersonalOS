import { useId } from "react";

import { classNames } from "../../lib/class-names";
import { dataSeriesDashes, type DataSeriesTone } from "./data-series";

export type SparklineSeries = {
  id: string;
  label: string;
  points: number[];
  tone: DataSeriesTone;
};

export type SparklineProps = {
  /** Höchstens drei Serien; weitere werden bewusst nicht gezeichnet. */
  series: SparklineSeries[];
  className?: string;
  /** Weicher Verlauf unter der ersten Serie, rein dekorativ. */
  filled?: boolean;
  showGrid?: boolean;
  variant?: "mini" | "chart";
};

const maximumSeries = 3;
const viewWidth = 100;
const viewHeight = 32;
const verticalPadding = 3;
const gridSteps = [0.25, 0.5, 0.75];

export function Sparkline({
  className,
  filled = false,
  series,
  showGrid = false,
  variant = "mini",
}: SparklineProps) {
  const gradientId = useId();
  const visibleSeries = series.slice(0, maximumSeries);
  const values = visibleSeries.flatMap((entry) => entry.points);
  const leadSeries = visibleSeries[0];

  if (values.length === 0 || !leadSeries) {
    return null;
  }

  const minimum = Math.min(...values);
  const maximum = Math.max(...values);

  return (
    <svg
      aria-hidden="true"
      className={classNames("ui-sparkline", className)}
      data-variant={variant}
      focusable="false"
      preserveAspectRatio="none"
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
    >
      {filled ? (
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop
              className="ui-sparkline-area-start"
              data-tone={leadSeries.tone}
              offset="0%"
            />
            <stop
              className="ui-sparkline-area-end"
              data-tone={leadSeries.tone}
              offset="100%"
            />
          </linearGradient>
        </defs>
      ) : null}

      {showGrid
        ? gridSteps.map((step) => {
            const y = verticalPadding + step * usableHeight();
            return (
              <line
                className="ui-sparkline-grid"
                key={step}
                vectorEffect="non-scaling-stroke"
                x1="0"
                x2={viewWidth}
                y1={y}
                y2={y}
              />
            );
          })
        : null}

      {filled ? (
        <path
          d={buildAreaPath(leadSeries.points, minimum, maximum)}
          fill={`url(#${gradientId})`}
        />
      ) : null}

      {visibleSeries.map((entry) => (
        <path
          className="ui-sparkline-line"
          d={buildLinePath(entry.points, minimum, maximum)}
          data-tone={entry.tone}
          key={entry.id}
          strokeDasharray={dataSeriesDashes[entry.tone]}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

function usableHeight(): number {
  return viewHeight - verticalPadding * 2;
}

function toCoordinates(
  points: number[],
  minimum: number,
  maximum: number,
): Array<[number, number]> {
  const span = maximum - minimum;

  return points.map((point, index) => {
    const x =
      points.length === 1
        ? viewWidth / 2
        : (index / (points.length - 1)) * viewWidth;
    const normalized = span === 0 ? 0.5 : (point - minimum) / span;
    return [x, verticalPadding + (1 - normalized) * usableHeight()];
  });
}

function buildLinePath(
  points: number[],
  minimum: number,
  maximum: number,
): string {
  return toCoordinates(points, minimum, maximum)
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${round(x)} ${round(y)}`)
    .join(" ");
}

function buildAreaPath(
  points: number[],
  minimum: number,
  maximum: number,
): string {
  const coordinates = toCoordinates(points, minimum, maximum);
  const first = coordinates[0]!;
  const last = coordinates.at(-1)!;

  return `${buildLinePath(points, minimum, maximum)} L${round(last[0])} ${viewHeight} L${round(first[0])} ${viewHeight} Z`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
