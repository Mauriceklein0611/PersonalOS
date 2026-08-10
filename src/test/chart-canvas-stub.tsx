import type { ChartCanvasProps } from "../components/ui/charts/ChartCanvas";

/**
 * Ersatz für `ChartCanvas` in Tests. Das Laden von ECharts durch die
 * Transform-Pipeline dauert in jsdom mehrere Sekunden und ließ Tests unter
 * paralleler Last zufällig in die Wartezeit laufen.
 *
 * Der Ersatz zeichnet dieselbe Fläche mit denselben Attributen. Geprüft wird
 * in Komponententests ohnehin nur, dass die Grafik existiert und rein
 * dekorativ ist; die Optionen selbst deckt `chart-option.test.ts` direkt ab.
 * Das Datenattribut belegt, dass der Ersatz greift.
 */
export default function ChartCanvasStub({ formatValue }: ChartCanvasProps) {
  /*
   * Das eine Verhalten der Bibliothek, das der Ersatz nachbildet: Sie
   * beschriftet die Achse mit berechneten Teilstrichen, nicht nur mit
   * erfassten Werten. Ein `formatValue`, das daran scheitert, hat in #107 die
   * ganze Finanzseite gerissen. Ohne diesen Aufruf bliebe der Fall in
   * Komponententests unsichtbar.
   */
  formatValue(0.5);

  return (
    <div
      aria-hidden="true"
      className="ui-chart-plot"
      data-chart-stub="true"
      data-testid="chart-plot"
    />
  );
}
