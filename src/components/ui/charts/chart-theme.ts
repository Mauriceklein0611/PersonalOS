import { dataSeriesTones, type DataSeriesTone } from "../data-series";

/**
 * Das Diagramm-Theme wird zur Laufzeit aus den CSS-Tokens gelesen. Farbwerte
 * werden dadurch genau einmal gepflegt, in `src/styles/tokens.css`, und ein
 * Theme-Wechsel wirkt ohne zweite Quelle.
 */
export type ChartTheme = {
  areaOpacity: number;
  edge: string;
  glass: string;
  grid: string;
  series: Record<DataSeriesTone, string>;
  text: string;
  textMuted: string;
  track: string;
};

/**
 * Fallbacks für Umgebungen ohne geladenes Stylesheet, etwa jsdom im Test. Sie
 * halten das Diagramm lesbar und sind bewusst neutral.
 */
const fallbackTheme: ChartTheme = {
  areaOpacity: 0.3,
  edge: "#8a8f9e",
  glass: "#2f1539",
  grid: "#8a8f9e",
  series: {
    1: "#ffd88a",
    2: "#ffb27d",
    3: "#ff8fb3",
    4: "#c78bff",
    5: "#ff9d9d",
    6: "#f0e08a",
  },
  text: "#f4f6ff",
  textMuted: "#c9cee6",
  track: "#8a8f9e",
};

export function readChartTheme(
  root: HTMLElement | null = typeof document === "undefined"
    ? null
    : document.documentElement,
): ChartTheme {
  if (root === null) {
    return fallbackTheme;
  }

  const styles = getComputedStyle(root);
  const read = (name: string, fallback: string) => {
    const value = styles.getPropertyValue(name).trim();
    return value.length > 0 ? value : fallback;
  };

  const series = Object.fromEntries(
    dataSeriesTones.map((tone) => [
      tone,
      read(`--data-${tone}`, fallbackTheme.series[tone]),
    ]),
  ) as Record<DataSeriesTone, string>;

  const areaOpacity = Number.parseFloat(
    read("--chart-area-opacity", String(fallbackTheme.areaOpacity)),
  );

  return {
    areaOpacity: Number.isFinite(areaOpacity)
      ? areaOpacity
      : fallbackTheme.areaOpacity,
    edge: read("--edge", fallbackTheme.edge),
    glass: read("--glass-opaque", fallbackTheme.glass),
    grid: read("--chart-grid", fallbackTheme.grid),
    series,
    text: read("--text", fallbackTheme.text),
    textMuted: read("--text-muted", fallbackTheme.textMuted),
    track: read("--chart-track", fallbackTheme.track),
  };
}

/**
 * Verlauf als Flächenschmuck unter einer Linie oder in einem Balken. Er
 * codiert keine Kategorie; die Kategorie steckt in der Serienfarbe selbst.
 */
export function verticalFade(
  color: string,
  opacity: number,
): {
  colorStops: Array<{ color: string; offset: number }>;
  type: "linear";
  x: number;
  x2: number;
  y: number;
  y2: number;
} {
  return {
    colorStops: [
      { color: withAlpha(color, opacity), offset: 0 },
      { color: withAlpha(color, 0), offset: 1 },
    ],
    type: "linear",
    x: 0,
    x2: 0,
    y: 0,
    y2: 1,
  };
}

export function barFade(color: string): ReturnType<typeof verticalFade> {
  return {
    colorStops: [
      { color: withAlpha(color, 1), offset: 0 },
      { color: withAlpha(color, 0.55), offset: 1 },
    ],
    type: "linear",
    x: 0,
    x2: 0,
    y: 0,
    y2: 1,
  };
}

/**
 * Setzt die Deckkraft einer Tokenfarbe. Tokens liegen als `#rrggbb` oder als
 * `rgb(r g b / a%)` vor; beides muss ohne zweite Farbquelle funktionieren.
 */
export function withAlpha(color: string, alpha: number): string {
  const channels = toChannels(color);
  if (channels === undefined) {
    return color;
  }

  const [red, green, blue, baseAlpha] = channels;
  const combined = Math.max(0, Math.min(1, baseAlpha * alpha));
  return `rgba(${red}, ${green}, ${blue}, ${roundAlpha(combined)})`;
}

function toChannels(
  color: string,
): [number, number, number, number] | undefined {
  const trimmed = color.trim();

  if (trimmed.startsWith("#")) {
    const digits =
      trimmed.length === 4
        ? [...trimmed.slice(1)].map((digit) => `${digit}${digit}`).join("")
        : trimmed.slice(1, 7);
    if (digits.length !== 6) return undefined;
    const value = Number.parseInt(digits, 16);
    if (Number.isNaN(value)) return undefined;
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 1];
  }

  const numbers = trimmed.match(/[\d.]+%?/g);
  if (numbers === null || numbers.length < 3) return undefined;
  const [red, green, blue, opacity] = numbers;

  return [
    Number.parseFloat(red!),
    Number.parseFloat(green!),
    Number.parseFloat(blue!),
    opacity === undefined ? 1 : toUnitInterval(opacity),
  ];
}

function toUnitInterval(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return 1;
  return value.includes("%") ? parsed / 100 : parsed;
}

function roundAlpha(value: number): number {
  return Math.round(value * 1000) / 1000;
}
