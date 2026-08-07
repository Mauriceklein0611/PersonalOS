/**
 * Die dokumentierten Bundle-Budgets. Sie stehen hier und in
 * `docs/decisions/0008-echarts-for-charts.md`; die Prüfung in der CI hält
 * beide Seiten zusammen.
 *
 * Alle Werte sind gzip-Bytes mit dem Faktor 1.000 je kB — dieselbe Einheit,
 * die das Build-Log ausgibt.
 */
export const bundleBudgets = [
  {
    label: "Startroute",
    /*
     * Alles, was vor der ersten Route geladen wird: App-Shell, Router,
     * Persistenzschicht und die gemeinsame Token-Ebene.
     */
    pattern: /^index-[^/]+\.(?:css|js)$/,
    maximumGzipBytes: 165_000,
  },
  {
    label: "Diagramm-Chunk",
    pattern: /^ChartCanvas-[^/]+\.js$/,
    maximumGzipBytes: 190_000,
  },
];

export function formatKilobytes(bytes) {
  return `${(bytes / 1000).toFixed(2)} kB`;
}

/**
 * Vergleicht gemessene Dateien mit den Budgets. Ein Budget ohne passende
 * Datei ist ein Fehler und kein bestandener Test: Es hieße, dass die Prüfung
 * ins Leere läuft, etwa nach einer Umbenennung des Chunks.
 */
export function findBundleBudgetIssues(measurements, budgets = bundleBudgets) {
  const issues = [];

  for (const budget of budgets) {
    const matched = measurements.filter((entry) =>
      budget.pattern.test(entry.name),
    );

    if (matched.length === 0) {
      issues.push({
        budget: budget.label,
        kind: "missing",
        message: `Für „${budget.label}" wurde keine passende Datei gefunden. Prüfe das Muster ${String(budget.pattern)}.`,
      });
      continue;
    }

    const gzipBytes = matched.reduce(
      (total, entry) => total + entry.gzipBytes,
      0,
    );
    if (gzipBytes > budget.maximumGzipBytes) {
      issues.push({
        budget: budget.label,
        kind: "exceeded",
        message: `„${budget.label}" liegt bei ${formatKilobytes(gzipBytes)} gzip und überschreitet das dokumentierte Budget von ${formatKilobytes(budget.maximumGzipBytes)}.`,
      });
    }
  }

  return issues;
}

export function summariseMeasurements(measurements, budgets = bundleBudgets) {
  return budgets.map((budget) => {
    const gzipBytes = measurements
      .filter((entry) => budget.pattern.test(entry.name))
      .reduce((total, entry) => total + entry.gzipBytes, 0);

    return {
      label: budget.label,
      gzipBytes,
      maximumGzipBytes: budget.maximumGzipBytes,
    };
  });
}
