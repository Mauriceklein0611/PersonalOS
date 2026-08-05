import { classNames } from "../../lib/class-names";
import { noDataText } from "./data-series";

export type MetricTileProps = {
  label: string;
  /** Bereits formatierter Wert. `null` bedeutet: keine Datenbasis. */
  value: string | null;
  className?: string;
  context?: string;
  error?: string;
  tone?: "default" | "hero";
};

export function MetricTile({
  className,
  context,
  error,
  label,
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
        </>
      )}
    </div>
  );
}
