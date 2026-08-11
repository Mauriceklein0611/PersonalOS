import { describe, expect, it } from "vitest";

/*
 * Der Netzwerktest in `e2e/today.spec.ts` beweist, dass die Startroute den
 * Diagramm-Chunk nicht anfordert. Er kann aber erst anschlagen, wenn der
 * Fehler schon gebaut ist. Diese Prüfung liest den Quelltext und schlägt
 * bereits an, wenn jemand die Bibliothek statisch hereinholt.
 *
 * Testdateien bleiben außen vor: Sie beschreiben die Regel und enthalten die
 * gesuchten Zeichenketten deshalb zwangsläufig selbst.
 */
const sources = Object.entries(
  import.meta.glob("/src/**/*.{ts,tsx}", {
    eager: true,
    import: "default",
    query: "?raw",
  }) as Record<string, string>,
)
  .map(([path, content]) => ({ content, name: path.replace("/src/", "") }))
  .filter((file) => !file.name.includes(".test."));

describe("chart library boundary", () => {
  it("finds the sources it is meant to guard", () => {
    expect(sources.length).toBeGreaterThan(80);
    expect(sources.map((file) => file.name)).toContain(
      "components/ui/charts/echarts-core.ts",
    );
  });

  it("imports echarts in exactly one module", () => {
    const importers = sources
      .filter((file) => /from\s+"echarts\//.test(file.content))
      .map((file) => file.name);

    expect(importers).toEqual(["components/ui/charts/echarts-core.ts"]);
  });

  it("reaches the canvas only through a dynamic import or a type", () => {
    const references = sources.filter(
      (file) =>
        file.name !== "components/ui/charts/ChartCanvas.tsx" &&
        /ChartCanvas["']/.test(file.content),
    );

    expect(references.map((file) => file.name).sort()).toEqual([
      "components/ui/charts/Chart.tsx",
      "test/chart-canvas-stub.tsx",
    ]);
    // Der Rahmen lädt die Zeichenfläche nach, der Teststub kennt nur den Typ.
    expect(byName(references, "components/ui/charts/Chart.tsx")).toMatch(
      /lazy\(\(\) => import\("\.\/ChartCanvas"\)\)/,
    );
    expect(byName(references, "test/chart-canvas-stub.tsx")).toMatch(
      /import type \{[^}]*\} from "\.\.\/components\/ui\/charts\/ChartCanvas"/,
    );
  });

  it("keeps the dense grids free of the chart component", () => {
    /*
     * Monatsraster und Wochenplan sind die dichten Ansichten aus #122 und
     * #123. Sie zeigen Zustand und Quote über `TrackerCell` und
     * `ProgressBar`; ein Diagramm dort zöge die Bibliothek in die primäre
     * Arbeitsfläche.
     */
    for (const name of [
      "domains/habits/components/HabitMonthGrid.tsx",
      "domains/tasks/components/TaskWeekPlanner.tsx",
    ]) {
      expect(byName(sources, name)).not.toMatch(/\bChart\b/);
    }
  });
});

function byName(
  files: ReadonlyArray<{ content: string; name: string }>,
  name: string,
): string {
  const file = files.find((candidate) => candidate.name === name);
  if (file === undefined) throw new Error(`Datei ${name} nicht gefunden`);
  return file.content;
}
