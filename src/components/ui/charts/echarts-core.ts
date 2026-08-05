import { BarChart, LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { SVGRenderer } from "echarts/renderers";

/*
 * Nur die tatsächlich verwendeten Bausteine werden registriert. Ein Import von
 * `echarts` als Ganzes würde den kompletten Funktionsumfang bündeln und das
 * Bundle-Budget aus ADR 0008 sprengen. Nicht dabei sind `PieChart`, weil keine
 * Ansicht ihn braucht, und `LegendComponent`, weil die Legende als HTML-Liste
 * neben der Grafik steht und dort auch ohne Farbe lesbar bleibt.
 *
 * Der SVG-Renderer statt Canvas: Er zeichnet auf Retina-Displays scharf, kommt
 * ohne Zeichenfläche in Testumgebungen aus und erzeugt weniger Code.
 *
 * Dieses Modul wird ausschließlich dynamisch geladen, siehe `Chart.tsx`.
 */
echarts.use([
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  SVGRenderer,
]);

export { echarts };
export type { EChartsCoreOption, EChartsType } from "echarts/core";
