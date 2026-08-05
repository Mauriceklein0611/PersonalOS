import {
  dataSeriesDashes,
  noDataText,
  type DataSeriesTone,
} from "../data-series";
import {
  accentStroke,
  barFade,
  verticalFade,
  withAlpha,
  type ChartTheme,
} from "./chart-theme";
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
    axisLabel: {
      color: theme.textMuted,
      fontSize: 11,
      /*
       * Ohne eigenen Formatter beschriftet die Bibliothek die Rohwerte. Bei
       * Geldbeträgen sind das Minor Units, also das Hundertfache des
       * erwarteten Betrags.
       */
      formatter: (value: number) => formatValue(value),
    },
    axisLine: { show: false },
    // Zurückhaltendes Gitternetz: nur Hilfslinien quer zur Kategorieachse.
    splitLine: { lineStyle: { color: theme.grid, type: "dashed" as const } },
    type: "value" as const,
  };

  return {
    animation: !prefersReducedMotion(),
    animationDuration: 180,
    /*
     * Feste Ränder statt `containLabel`: Das ist in ECharts 6 der unterstützte
     * Weg. Der linke Rand fasst auch einen formatierten Geldbetrag.
     */
    grid: { bottom: 34, left: horizontal ? 96 : 76, right: 12, top: 12 },
    series: series.map((entry, index) =>
      toSeriesOption(entry, theme, type, index),
    ),
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
  index: number,
) {
  const color = theme.series[entry.tone];

  if (type === "bar") {
    return {
      barWidth: "52%",
      data: entry.values,
      itemStyle: { borderRadius: [10, 10, 4, 4], color: barFade(color) },
      name: entry.label,
      type: "bar" as const,
    };
  }

  /*
   * Die führende Serie trägt den Akzentverlauf und einen weichen Schein, die
   * weiteren bleiben in ihrer Datenfarbe. Der Schein ist Schmuck; die Serien
   * bleiben über Strichmuster und Legende unterscheidbar.
   */
  const lead = index === 0;
  const stroke = lead ? accentStroke(theme.accent1, theme.accent2) : color;

  return {
    areaStyle: {
      color: verticalFade(lead ? theme.accent1 : color, theme.areaOpacity),
    },
    data: entry.values,
    itemStyle: { color: lead ? theme.accent1 : color },
    lineStyle: {
      color: stroke,
      shadowBlur: lead ? 14 : 0,
      shadowColor: withAlpha(lead ? theme.accent1 : color, 0.5),
      type: toDashArray(entry.tone),
      width: lead ? 3 : 2,
    },
    name: entry.label,
    showSymbol: false,
    smooth: true,
    symbol: "circle",
    symbolSize: 8,
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
