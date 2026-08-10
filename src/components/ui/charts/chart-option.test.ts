import { describe, expect, it, vi } from "vitest";

import { buildChartOption, type ChartOptionInput } from "./chart-option";
import type { ChartSeries } from "./chart-series";
import type { ChartTheme } from "./chart-theme";

type Gradient = { colorStops: Array<{ color: string; offset: number }> };

type SeriesOption = {
  data:
    Array<{ symbolSize: number; value: number | null }> | Array<number | null>;
  itemStyle: { color: Gradient | string };
  lineStyle: {
    color: Gradient | string;
    shadowBlur: number;
    type: number[] | string;
  };
  type: string;
};

/** Nur die Felder, die diese Prüfungen lesen. */
type BuiltOption = {
  animation: boolean;
  series: SeriesOption[];
  tooltip: { valueFormatter: (value: unknown) => string };
  xAxis: { data?: string[]; type: string };
  yAxis: {
    axisLabel?: { formatter?: (value: number) => string };
    type: string;
  };
};

const theme: ChartTheme = {
  accent1: "#ffb27d",
  accent2: "#ff8fb3",
  areaOpacity: 0.3,
  edge: "#ffffff",
  glass: "#3a2040",
  grid: "#888888",
  series: {
    1: "#ffd88a",
    2: "#ffb27d",
    3: "#ff9dbd",
    4: "#d5a6ff",
    5: "#ff9d9d",
    6: "#f0e08a",
  },
  text: "#f4f6ff",
  textMuted: "#e2e8ff",
  track: "#777777",
};

const series: ChartSeries[] = [
  { id: "a", label: "A", tone: 1, values: [1, 2, 3] },
  { id: "b", label: "B", tone: 2, values: [3, 2, 1] },
];

function build(overrides: Partial<ChartOptionInput> = {}): BuiltOption {
  return buildChartOption({
    categories: ["Mo", "Di", "Mi"],
    formatValue: (value) => `${value} %`,
    horizontal: false,
    series,
    theme,
    type: "line",
    ...overrides,
  }) as unknown as BuiltOption;
}

function asGradient(value: Gradient | string): Gradient {
  if (typeof value === "string") {
    throw new TypeError(`Erwartet wurde ein Verlauf, gefunden: ${value}`);
  }
  return value;
}

describe("buildChartOption", () => {
  it("puts the categories on the x axis and the values on the y axis", () => {
    const option = build();

    expect(option.xAxis.type).toBe("category");
    expect(option.xAxis.data).toEqual(["Mo", "Di", "Mi"]);
    expect(option.yAxis.type).toBe("value");
  });

  it("swaps both axes for a horizontal bar chart", () => {
    const option = build({ horizontal: true, type: "bar" });

    expect(option.xAxis.type).toBe("value");
    expect(option.yAxis.type).toBe("category");
  });

  // Die führende Serie trägt den Akzentverlauf, die weitere ihre Datenfarbe.
  it("gives the lead series the accent gradient and a soft glow", () => {
    const [lead, second] = build().series;

    expect(asGradient(lead!.lineStyle.color).colorStops).toEqual([
      { color: "#ffb27d", offset: 0 },
      { color: "#ff8fb3", offset: 1 },
    ]);
    expect(lead!.lineStyle.shadowBlur).toBeGreaterThan(0);
    expect(second!.lineStyle.color).toBe("#ffb27d");
    expect(second!.lineStyle.shadowBlur).toBe(0);
  });

  it("keeps every series distinguishable by its dash pattern", () => {
    const [lead, second] = build().series;

    expect(lead!.lineStyle.type).toBe("solid");
    expect(second!.lineStyle.type).toEqual([7, 4]);
  });

  it("fills bars from full colour at the top to nearly transparent", () => {
    const [first] = build({ type: "bar" }).series;
    const stops = asGradient(first!.itemStyle.color).colorStops;

    expect(first!.type).toBe("bar");
    expect(stops[0]!.color).toContain("1)");
    expect(stops[1]!.color).toContain("0.25)");
  });

  it("formats tooltip values and names missing ones", () => {
    const { valueFormatter } = build().tooltip;

    expect(valueFormatter(42)).toBe("42 %");
    expect(valueFormatter(null)).toBe("Keine Angabe");
  });

  // Ohne eigenen Formatter beschriftete die Achse die Rohwerte, bei Geld also
  // Minor Units statt Beträgen.
  it("formats the value axis with the same formatter", () => {
    expect(build().yAxis.axisLabel?.formatter?.(42)).toBe("42 %");
  });

  /*
   * Ein Wert zwischen zwei Lücken hat keinen Nachbarn, zu dem eine Strecke
   * führen könnte. Ohne eigenen Punkt fehlte er in der Linie vollständig.
   */
  it("draws a point for a value between two gaps", () => {
    const option = build({
      categories: ["Mo", "Di", "Mi", "Do"],
      series: [{ id: "a", label: "A", tone: 1, values: [1, null, 3, null] }],
    });

    // Auch der erste Wert steht allein: Der Rand zählt wie eine Lücke.
    expect(option.series[0]!.data).toEqual([
      { symbolSize: 8, value: 1 },
      { symbolSize: 0, value: null },
      { symbolSize: 8, value: 3 },
      { symbolSize: 0, value: null },
    ]);
  });

  it("leaves a value that still has a neighbour without a point", () => {
    const option = build({
      categories: ["Mo", "Di", "Mi", "Do"],
      series: [{ id: "a", label: "A", tone: 1, values: [1, 2, null, 4] }],
    });

    expect(option.series[0]!.data).toEqual([
      { symbolSize: 0, value: 1 },
      { symbolSize: 0, value: 2 },
      { symbolSize: 0, value: null },
      { symbolSize: 8, value: 4 },
    ]);
  });

  it("leaves a gapless line without any points", () => {
    const sizes = (
      build().series[0]!.data as Array<{ symbolSize: number }>
    ).map((point) => point.symbolSize);

    expect(sizes).toEqual([0, 0, 0]);
  });

  it("switches the animation off for reduced motion", () => {
    const matchMedia = vi
      .spyOn(window, "matchMedia")
      .mockReturnValue({ matches: true } as MediaQueryList);

    expect(build().animation).toBe(false);

    matchMedia.mockRestore();
    expect(build().animation).toBe(true);
  });
});
