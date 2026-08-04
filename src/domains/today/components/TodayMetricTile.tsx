type TodayMetricTileProps = {
  context: string;
  label: string;
  value: string;
};

/**
 * Der Wert steht als Text in der Kachel. Eine spätere grafische Ebene ergänzt
 * ihn, ersetzt ihn aber nicht.
 */
export function TodayMetricTile({
  context,
  label,
  value,
}: TodayMetricTileProps) {
  return (
    <div className="today-metric-tile">
      <p className="today-metric-label">{label}</p>
      <p className="today-metric-value">{value}</p>
      <p className="today-metric-context">{context}</p>
    </div>
  );
}
