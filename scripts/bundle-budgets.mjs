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
  {
    label: "Einzelner Routen-Chunk",
    /*
     * Alles außerhalb von Startroute und Diagramm: Routen, ihre Stile und die
     * geteilten Domänenmodule. Jede Datei wird einzeln geprüft, nicht ihre
     * Summe — die Summe wüchse mit jeder neuen Route und sagte nichts darüber,
     * ob eine einzelne Ansicht aus dem Rahmen fällt.
     *
     * Der größte Chunk liegt bei rund 13 kB gzip. Das Budget lässt Luft für
     * Wachstum und schlägt trotzdem an, sobald eine Bibliothek in einer Route
     * landet, die dort nicht hingehört — allen voran die Diagrammbibliothek.
     */
    pattern: /^(?!index-|ChartCanvas-)[^/]+\.(?:js|css)$/,
    maximumGzipBytes: 25_000,
    perFile: true,
  },
];

export function formatKilobytes(bytes) {
  return `${(bytes / 1000).toFixed(2)} kB`;
}

/**
 * Vergleicht gemessene Dateien mit den Budgets. Ein Budget ohne passende
 * Datei ist ein Fehler und kein bestandener Test: Es hieße, dass die Prüfung
 * ins Leere läuft, etwa nach einer Umbenennung des Chunks.
 *
 * Ein Budget mit `perFile` prüft jede Datei einzeln und meldet die größte;
 * ohne die Angabe zählt die Summe aller passenden Dateien.
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

    if (budget.perFile) {
      for (const entry of matched) {
        if (entry.gzipBytes > budget.maximumGzipBytes) {
          issues.push({
            budget: budget.label,
            kind: "exceeded",
            message: `„${entry.name}" liegt bei ${formatKilobytes(entry.gzipBytes)} gzip und überschreitet das dokumentierte Budget von ${formatKilobytes(budget.maximumGzipBytes)} je ${budget.label}.`,
          });
        }
      }
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
    const matched = measurements.filter((entry) =>
      budget.pattern.test(entry.name),
    );

    /*
     * Bei `perFile` steht die größte Datei für das Budget: Nur sie entscheidet,
     * ob es eingehalten ist, und nur sie ist die Zahl, die jemand ablesen will.
     */
    const largest = matched.reduce(
      (current, entry) =>
        current === undefined || entry.gzipBytes > current.gzipBytes
          ? entry
          : current,
      undefined,
    );

    return {
      label: budget.label,
      gzipBytes: budget.perFile
        ? (largest?.gzipBytes ?? 0)
        : matched.reduce((total, entry) => total + entry.gzipBytes, 0),
      maximumGzipBytes: budget.maximumGzipBytes,
      ...(budget.perFile ? { largestFile: largest?.name } : {}),
    };
  });
}
