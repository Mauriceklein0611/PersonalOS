import { useEffect, useMemo, useRef, useState } from "react";

import { buildChartOption } from "./chart-option";
import type { ChartSeries } from "./chart-series";
import { readChartTheme, type ChartTheme } from "./chart-theme";
import { echarts, type EChartsType } from "./echarts-core";

export type ChartCanvasProps = {
  categories: string[];
  formatValue: (value: number) => string;
  horizontal: boolean;
  series: ChartSeries[];
  type: "line" | "bar";
};

/**
 * Trägt als einziges Modul die Bibliothek. Es wird dynamisch geladen, damit
 * ECharts nicht im Startbündel liegt.
 */
export default function ChartCanvas({
  categories,
  formatValue,
  horizontal,
  series,
  type,
}: ChartCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const [theme, setTheme] = useState<ChartTheme>(() => readChartTheme());
  const [failure, setFailure] = useState<unknown>(null);

  /*
   * Die Bibliothek zeichnet auch außerhalb des React-Ablaufs, etwa aus dem
   * `ResizeObserver`. Ein Fehler von dort erreicht keine Fehlergrenze und
   * bliebe unbehandelt. Er wird deshalb gemerkt und beim nächsten Rendern
   * geworfen, wo `ChartErrorBoundary` ihn auffängt.
   */
  if (failure !== null) throw failure;

  // Ein Theme-Wechsel schaltet die CSS-Tokens um; das Diagramm liest sie neu.
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setTheme(readChartTheme(root)));
    observer.observe(root, { attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (element === null) return undefined;

    const chart = echarts.init(element, undefined, {
      height: element.clientHeight || 240,
      renderer: "svg",
      width: element.clientWidth || 320,
    });
    chartRef.current = chart;

    // Ein Neuzeichnen rechnet die Achsenbeschriftungen neu und ruft dabei
    // `formatValue`. Wirft es, endet der Fehler sonst im Beobachter.
    const resize = () => {
      try {
        chart.resize();
      } catch (error) {
        setFailure(error);
      }
    };
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
    observer?.observe(element);
    window.addEventListener("resize", resize);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  const option = useMemo(
    () =>
      buildChartOption({
        categories,
        formatValue,
        horizontal,
        series,
        theme,
        type,
      }),
    [categories, formatValue, horizontal, series, theme, type],
  );

  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  return (
    <div
      aria-hidden="true"
      className="ui-chart-plot"
      data-testid="chart-plot"
      ref={containerRef}
    />
  );
}
