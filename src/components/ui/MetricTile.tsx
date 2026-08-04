import { classNames } from "../../lib/class-names";
import { noDataText, type DataSeriesTone } from "./data-series";
import { Sparkline } from "./Sparkline";

export type MetricTileProps = {
  label: string;
  /** Bereits formatierter Wert. `null` bedeutet: keine Datenbasis. */
  value: string | null;
  className?: string;
  context?: string;
  error?: string;
  /** Rein dekorative Mini-Sparkline; die Aussage steht im Text. */
  sparkline?: number[];
  sparklineTone?: DataSeriesTone;
  tone?: "default" | "hero";
};

export function MetricTile({
  className,
  context,
  error,
  label,
  sparkline,
  sparklineTone = 1,
  tone = "default",
  value,
}: MetricTileProps) {
  return (
    <div className={classNames("ui-metric-tile", className)} data-tone={tone}>
      <p className="ui-metric-tile-label">{label}</p>
      {error ? (
        <p className="ui-dataviz-error">{error}</p>
      ) : (
        <>
          <p className="ui-metric-tile-value" data-empty={value === null}>
            {value ?? noDataText}
          </p>
          {context ? <p className="ui-metric-tile-context">{context}</p> : null}
          {value !== null && sparkline && sparkline.length > 1 ? (
            <Sparkline
              series={[
                {
                  id: "metric",
                  label,
                  points: sparkline,
                  tone: sparklineTone,
                },
              ]}
              filled
            />
          ) : null}
        </>
      )}
    </div>
  );
}
