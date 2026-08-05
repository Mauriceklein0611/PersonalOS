import {
  dataSeriesDashes,
  noDataText,
  type DataSeriesTone,
} from "../data-series";
import { barFade, verticalFade, type ChartTheme } from "./chart-theme";
import type { ChartSeries } from "./chart-series";
import type { EChartsCoreOption } from "./echarts-core";

export type ChartOptionInput = {
  categories: string[];
  formatValue: (value: number) => string;
  horizontal: boolean;
  series: ChartSeries[];
  theme: ChartTheme;
  type: "line" | "bar";
};

export function buildChartOption({
  categories,
  formatValue,
  horizontal,
  series,
  theme,
  type,
}: ChartOptionInput): EChartsCoreOption {
  const categoryAxis = {
    axisLabel: { color: theme.textMuted, fontSize: 11, hideOverlap: true },
    axisLine: { lineStyle: { color: theme.grid } },
    axisTick: { show: false },
    boundaryGap: type === "bar",
    data: categories,
    type: "category" as const,
  };

  const valueAxis = {
    axisLabel: { color: theme.textMuted, fontSize: 11 },
    axisLine: { show: false },
    // Zurückhaltendes Gitternetz: nur Hilfslinien quer zur Kategorieachse.
    splitLine: { lineStyle: { color: theme.grid, type: "dashed" as const } },
    type: "value" as const,
  };

  return {
    animation: !prefersReducedMotion(),
    animationDuration: 180,
    // Feste Ränder statt `containLabel`: Das ist in ECharts 6 der unterstützte
    // Weg und lässt Achsenbeschriftungen zuverlässig Platz.
    grid: { bottom: 34, left: 44, right: 12, top: 12 },
    series: series.map((entry) => toSeriesOption(entry, theme, type)),
    textStyle: { color: theme.text, fontFamily: "inherit" },
    tooltip: {
      backgroundColor: theme.glass,
      borderColor: theme.edge,
      borderWidth: 1,
      textStyle: { color: theme.text },
      trigger: "axis",
      valueFormatter: (value: unknown) =>
        typeof value === "number" ? formatValue(value) : noDataText,
    },
    xAxis: horizontal ? valueAxis : categoryAxis,
    yAxis: horizontal ? categoryAxis : valueAxis,
  };
}

function toSeriesOption(
  entry: ChartSeries,
  theme: ChartTheme,
  type: "line" | "bar",
) {
  const color = theme.series[entry.tone];

  if (type === "bar") {
    return {
      barMaxWidth: 28,
      data: entry.values,
      itemStyle: { borderRadius: 6, color: barFade(color) },
      name: entry.label,
      type: "bar" as const,
    };
  }

  return {
    areaStyle: { color: verticalFade(color, theme.areaOpacity) },
    data: entry.values,
    itemStyle: { color },
    // Strichmuster hält Serien auch ohne Farbunterscheidung auseinander.
    lineStyle: { color, type: toDashArray(entry.tone), width: 2 },
    name: entry.label,
    showSymbol: false,
    smooth: 0.3,
    symbol: "circle",
    type: "line" as const,
  };
}

function toDashArray(tone: DataSeriesTone): number[] | "solid" {
  const dashes = dataSeriesDashes[tone];
  if (dashes === undefined) return "solid";
  return dashes.split(" ").map((part) => Number.parseFloat(part));
}

/** Die Vorschrift verlangt, dass reduzierte Bewegung auch Diagramme betrifft. */
function prefersReducedMotion(): boolean {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
